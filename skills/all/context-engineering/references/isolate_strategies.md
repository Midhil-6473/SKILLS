# Isolate Strategies — Sub-Agents and Context Splitting

## Why isolation is the highest-leverage lever at scale

Anthropic's own multi-agent research system finding — **token usage explains
roughly 80% of performance variance** on a difficult benchmark, more than
model choice or tool-call count — is the strongest evidence in the field for
treating context isolation as a primary architectural lever, not an
optimization to consider later. The mechanism: **give each sub-agent its own,
fresh, focused context window**, so a complex task's total context burden is
distributed across multiple clean working memories instead of accumulating
in one ever-growing single agent's context.

In one internal comparison, a multi-agent system with proper isolation
outperformed a single large-model agent by over 90% on breadth-first
research tasks — a single agent doing sequential, increasingly-encumbered
search fell behind a set of isolated sub-agents each working with a clean
slate on their own piece of the task.

## The core mechanism — context isolation with summary return

```
Lead Agent (maintains the overall task context)
     │
     ├─→ spawns Sub-agent A (fresh, focused context — sees ONLY what it needs for its subtask)
     │        → does its work, entirely in its own isolated context
     │        → returns a CONDENSED SUMMARY (typically 1,000-2,000 tokens) to the lead
     │
     ├─→ spawns Sub-agent B (fresh, focused context, independent of A)
     │        → same pattern
     │
     └─→ Lead agent's context grows only by the SUMMARIES, never by the
          sub-agents' full working context
```

**This is the dominant multi-agent pattern in production** — used by Claude
Code, OpenAI's Agents SDK, LangGraph, CrewAI, Google's ADK, and Manus. The
parent agent never sees the child's full context, which is precisely what
makes the "who compacts the child's context" question moot for this pattern
— the child's context is simply discarded once it returns its summary; there's
nothing to compact because it never becomes the parent's problem.

## The three multi-agent context patterns

| Pattern | How it works | Adoption |
|---|---|---|
| **Context isolation + summary return** | Each sub-agent has its own context; only a final condensed summary returns to the parent | The dominant pattern — Claude Code, OpenAI Agents SDK, LangGraph, CrewAI, Google ADK, Manus |
| **Delegated compaction** | A group manager compresses the *shared* conversation and broadcasts the compressed version to all agents | Rare — AutoGen's `CompressibleGroupManager` is the primary production example |
| **(Implicit) shared full context** | All agents see the same, single growing context | Generally avoided at scale — this is exactly the pattern that reintroduces the context-rot and token-cost problems isolation is meant to solve |

**Default to context isolation with summary return** unless you have a
specific reason multiple agents genuinely need to share live, uncompressed
context (a tightly-coupled collaborative task where isolation would lose
critical shared state) — this is the pattern with the broadest adoption and
the clearest mental model for reasoning about where information flows.

## Sizing sub-agent summaries

**1,000-2,000 tokens is the typical target for a sub-agent's return
summary** — condensed enough that many sub-agent results can accumulate in
the lead agent's context without it becoming a new bloat source, detailed
enough to actually convey the sub-agent's findings usefully. This number is a
starting heuristic, not a hard rule — tune it against your own workload,
but treat "the sub-agent's return payload is nearly as large as its own
working context was" as a sign the isolation isn't actually providing its
intended benefit.

## Background agents and delta summarization

For agents doing continuous, long-running background work (not a single
bounded subtask), **delta summarization** — producing brief (1-2 sentence)
incremental updates rather than reprocessing the full accumulated context on
every update — avoids the cost of re-summarizing an ever-growing history on
every single progress report. Sub-agent transcripts in this pattern typically
persist in separate files, unaffected by whatever compaction happens in the
main/parent conversation — reinforcing the same separation-of-concerns
principle as `write_strategies.md`'s memory hierarchy.

## Scoped memory by role — isolation beyond just sub-agent spawning

Isolation isn't only about spawning sub-agents for discrete subtasks — it
also applies to **giving different persistent roles genuinely different,
scoped memory**:

```
A citation-tracking agent: sees ONLY reference/source metadata —
  no company details, no pricing, no vertical-specific context it doesn't need

A pricing agent: sees ONLY pricing/vertical context —
  no citation-tracking minutiae
```

This avoids **clutter and contradiction** — a role-scoped agent stays lean
and focused specifically because it was never given information outside its
scope to begin with, rather than being given everything and trusted to
ignore what's irrelevant (which is exactly the failure mode context rot
predicts will degrade performance).

## Token budget allocation across a multi-agent system

A steady-state 200K-token budget for a lead agent in a multi-agent system
might allocate roughly (treat the ratios, not the absolute numbers, as the
transferable guidance — they hold more stably across different total window
sizes than the raw token counts do):

```
System prompt + tool definitions:  a modest, fixed slice
Message history (before compaction): compress before this grows past
  roughly 15K tokens — compression at this point can achieve substantial
  (roughly 80%+) token reduction while preserving what matters
Sub-agent summaries (accumulated):   grows with the number of sub-agents
  used, which is exactly why keeping each summary to ~1-2K tokens matters
Remaining budget for output + tool responses: keep real headroom here —
  filling the window is itself the failure mode to avoid, not a target
```

## Practical guidance

1. **Default to context isolation with summary return** for multi-agent
   designs — it's the dominant, best-evidenced pattern, and the mental model
   (parent never sees child's full context) is the clearest to reason about.
2. **Treat isolation as a primary lever, not a late-stage optimization** —
   the 80%-of-variance finding means this should shape initial architecture,
   not be retrofitted after a single-agent design starts struggling.
3. **Target 1,000-2,000 tokens for sub-agent return summaries** as a starting
   heuristic, and watch for summaries that approach the sub-agent's own
   working-context size as a sign isolation isn't providing its intended
   benefit.
4. **Apply scoped memory by role even without spawning discrete sub-agents**
   — a persistent agent with a narrow role should have narrowly-scoped
   context, not full access it's expected to selectively ignore.
5. **Reserve delegated/shared-compaction patterns for genuinely
   tightly-coupled collaborative tasks** — they're the exception, not the
   default, precisely because they reintroduce some of what isolation is
   designed to avoid.