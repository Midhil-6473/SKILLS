# Compress Strategies — Compaction, Summarization, Tool-Result Clearing

## The core idea

**Compressing context means retaining only the tokens actually required to
continue the task** — distinct from Select (which decides *what* to include)
in that Compress operates on content you've already decided is relevant,
reducing its footprint without discarding it entirely. The three
most common mechanisms — compaction, tool-result clearing, and memory — are
easy to conflate since they all shrink context, but they target different
parts of the problem, and picking the right one depends on diagnosing which
part of your context is actually bloated.

## Compaction — summarizing and reinitiating

**Compaction** takes a conversation nearing its context limit, summarizes
its contents, and reinitiates the session with that summary in place of the
full history. It addresses the agent's own reasoning text, the user
back-and-forth, and decisions made over the course of the session.

```
Before compaction: [turn 1] [turn 2] ... [turn 47] [turn 48] (approaching limit)
After compaction:  [summary of turns 1-45] [turn 46] [turn 47] [turn 48]
```

**What survives compaction, and what doesn't**: goals, decisions, and major
discoveries are generally preserved in the summary; the *specific sequence*
of actions and *exact wording* from earlier turns generally are not. This is
exactly why persistent memory files (see `write_strategies.md`) exist as a
separate mechanism — anything that must survive with perfect fidelity
regardless of compaction (hard constraints, critical conventions) needs to
live outside the compacted conversation entirely, re-injected every turn
rather than trusted to a summarization pass.

### Provider-specific compaction mechanics (verify current specifics)

| Provider/Framework | Mechanism |
|---|---|
| **Claude Code** | Triggers automatically around ~95% context usage, or manually via `/compact`; strategy is LLM summarization; trigger threshold and summarization instructions are configurable |
| **OpenAI Agents SDK** | Offers two mechanisms — truncation (dropping input items, configurable to auto-drop from the middle of the conversation) and a dedicated compaction endpoint |
| **LangChain Deep Agents** | Built-in automatically on every `create_deep_agent` call — no additional middleware required; old messages compress into an LLM-generated summary as limits are approached |

**Customizing the compaction prompt matters** — what a summary retains
depends entirely on the instructions given to the summarization step; the
default compaction prompt is a reasonable starting point, not necessarily
tuned to what *your specific agent's* workload needs preserved. Testing
compaction behavior against your own workload (does the summary retain the
specific details your agent's later steps actually depend on?) is a real,
worthwhile validation step, not something to assume works correctly out of
the box.

## Tool-result clearing — a narrower, distinct technique from full compaction

Rather than summarizing an entire conversation, **tool-result clearing**
specifically removes or truncates the (often large) raw output of old tool
calls, once that output is no longer needed for the current step, while
leaving the surrounding conversation (reasoning, decisions) intact.

```python
def clear_old_tool_results(messages: list, keep_last_n_tool_results: int = 3) -> list:
    tool_result_indices = [i for i, m in enumerate(messages) if m["role"] == "tool"]
    indices_to_clear = tool_result_indices[:-keep_last_n_tool_results] if len(tool_result_indices) > keep_last_n_tool_results else []

    cleared = []
    for i, m in enumerate(messages):
        if i in indices_to_clear:
            cleared.append({**m, "content": "[Tool result cleared — no longer in active context]"})
        else:
            cleared.append(m)
    return cleared
```

**This is a different, often complementary lever to full compaction**: a
long agentic coding session might have relatively little *conversational*
bloat (the reasoning and decisions are compact) but enormous *tool-result*
bloat (many large file reads, command outputs, search results) — clearing
old tool results specifically targets that pattern without paying the cost
(and information loss) of summarizing the entire conversation. **Test
clearing configuration against your own workload's actual tool-use pattern**
— the right threshold (how many recent tool results to keep verbatim) is
workload-specific, not a universal constant.

## Diagnosing which compression problem you actually have

Before reaching for a specific technique, identify what's actually bloating
context — the fix differs by diagnosis:

| Symptom | Likely cause | Fix |
|---|---|---|
| Long conversational back-and-forth, many turns of reasoning/discussion | Conversation history bloat | Compaction (summarize the conversation) |
| A handful of turns, but each contains huge tool outputs (file dumps, large search results) | Tool-result bloat | Tool-result clearing (target the results specifically) |
| Critical rules/conventions getting lost after a compaction event | Missing persistent memory | Move that content to an AGENTS.md/CLAUDE.md-style file (see `write_strategies.md`), not just relying on compaction to preserve it |
| Context that's technically small but performance still degrades | Possible context rot from low-signal content, not raw volume | Curate for signal density (Select — see `select_strategies.md`), not just size |

## The opaque-compaction caveat

Some provider-level compaction mechanisms produce an **opaque, encrypted
state blob** that the model can interpret but that developers cannot
directly inspect — this may preserve more information than a plain-text
summary, but it's correspondingly harder to verify or debug what actually
survived. When observability into exactly what a compaction step preserved
matters for your use case (debugging a reliability issue, auditing agent
behavior), prefer a compaction mechanism that produces an inspectable
text summary over an opaque one, or explicitly test what information
survives a given opaque compaction implementation before depending on it.

## Practical guidance

1. **Diagnose before compressing** — conversation bloat, tool-result bloat,
   and missing persistent memory are three different problems with three
   different fixes; applying the wrong one wastes effort and can even hurt
   (over-aggressive compaction discarding something a persistent memory file
   should have owned).
2. **Customize the compaction prompt/instructions for your specific
   workload** rather than assuming the default preserves what your agent's
   later steps actually need.
3. **Use tool-result clearing specifically for tool-output-heavy workloads**
   (coding agents, search-heavy agents) as a distinct, often cheaper
   alternative to full-conversation compaction.
4. **Prefer inspectable compaction over opaque compaction** when debugging
   and observability into what survived matters for your use case.
5. **Never rely on compaction alone for information that must survive with
   perfect fidelity** — that's what persistent memory files are for.