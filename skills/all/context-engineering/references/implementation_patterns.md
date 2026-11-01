# Implementation Patterns — LangGraph, Claude Agent SDK, a Worked Example

## LangGraph — state as the context-control mechanism

LangGraph's `StateGraph` gives you an explicit schema for what's carried
between steps — the natural home for Write/Select strategies, since state
fields let you store information *outside* the LLM's active prompt and pull
specific fields back in only when a given node actually needs them.

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

class ResearchState(TypedDict):
    messages: Annotated[list, add_messages]      # the active conversation — LLM-facing
    research_notes: str                             # WRITE: accumulated findings, not in every prompt
    sources: list[dict]                              # WRITE: full source list, referenced not inlined
    current_summary: str                              # COMPRESS target: periodically condensed

def research_node(state: ResearchState) -> dict:
    # This node can read research_notes/sources from state WITHOUT them being
    # part of the LLM's message history — a clean SELECT of exactly what's needed
    relevant_notes = select_relevant_notes(state["research_notes"], state["messages"][-1])
    result = call_llm_with_context(state["messages"], relevant_notes)
    return {"messages": [result], "research_notes": state["research_notes"] + result.content}

def compress_node(state: ResearchState) -> dict:
    # A dedicated COMPRESS step, triggered on a schedule/condition, not ad hoc
    if estimate_tokens(state["messages"]) > COMPACTION_THRESHOLD:
        summary = summarize(state["messages"])
        return {"messages": [summary], "current_summary": summary}
    return {}
```

**The key architectural point**: state fields (`research_notes`, `sources`)
are not automatically part of what the LLM sees — a node explicitly decides
what to pull from state into the actual prompt for a given call. This is
Write and Select made concrete in LangGraph's own primitives, rather than an
add-on pattern bolted onto a plain message list.

## Isolation via sub-graphs

```python
from langgraph.graph import StateGraph

def run_isolated_subagent(subtask: str) -> str:
    # A completely separate graph invocation — its own state, its own context,
    # from scratch. Only the return value crosses back into the parent.
    sub_result = sub_agent_graph.invoke({"messages": [{"role": "user", "content": subtask}]})
    return summarize_for_parent(sub_result, max_tokens=1500)   # the ISOLATE summary-return pattern

def orchestrator_node(state: ResearchState) -> dict:
    subtask_results = [run_isolated_subagent(t) for t in state["pending_subtasks"]]
    return {"messages": [{"role": "assistant", "content": "\n".join(subtask_results)}]}
```

Each `sub_agent_graph.invoke()` call starts with a fresh state — none of the
parent's accumulated context carries over automatically, which is exactly
the isolation property described in `isolate_strategies.md`.

## Claude Agent SDK — hooks for context control points

```python
# Pre-compaction hook — a checkpoint fired just before compaction runs,
# letting you capture/preserve anything a default summarization pass might drop
def pre_compaction_hook(context: dict) -> None:
    critical_state = extract_critical_state(context["messages"])
    persist_to_memory_file(critical_state)   # WRITE strategy, deliberately triggered
                                                # right before COMPRESS would otherwise risk losing it
```

Structuring context control as explicit hooks at defined points in the
agent's lifecycle (before compaction, after a tool call, before a sub-agent
spawn) — rather than ad hoc string manipulation scattered through
application code — is what Google's ADK calls making the "compilation step"
of context assembly **observable and testable**: named, ordered
transformations you can reason about and verify, not implicit
concatenation logic buried in a prompt-building function.

## A worked example — a research agent's context flow, progressively improved

A useful way to internalize the four strategies is to see them applied
incrementally to the same agent, each addressing a specific failure mode
observed in the previous version:

```
v0 (naive): Single conversation, full history resent every turn, full tool
            results inlined directly into messages.
            → Works for short tasks; degrades and gets expensive on long ones.

v1 (+ Write): Add a plan.md file the agent writes to and reads from —
              the overall plan no longer needs to be re-derived or kept
              fully in the live conversation.
              → Long-running coherence improves; conversation still bloats
                with raw tool output.

v2 (+ Select): Tool results now save large output to workspace files and
               return short references; the agent reads full content back
               only when a specific later step needs it.
               → Token cost drops substantially; conversation stays lean.

v3 (+ Compress): A compaction step triggers once message history crosses a
                 threshold, summarizing older turns while preserving the
                 plan/notes files untouched (since those already live
                 outside the conversation).
                 → Long sessions no longer approach context limits;
                   degradation over session length drops.

v4 (+ Isolate): Genuinely independent subtasks (e.g., researching several
                unrelated sub-questions) get spawned as isolated sub-agents,
                each with fresh context, returning condensed summaries.
                → Parallelizable work no longer accumulates in one agent's
                  context; overall reliability on complex, multi-part tasks
                  improves substantially.
```

**Each version fixes a specific, previously-observed failure** — this is the
practical way to apply context engineering to a real agent: don't try to
implement all four strategies preemptively on day one; add each specifically
in response to a concrete, diagnosed problem (see
`measuring_and_debugging.md` for how to diagnose which one you're facing).

## Practical guidance

1. **Use LangGraph's state object as the concrete home for Write/Select
   strategies** — state fields that aren't automatically part of the LLM
   prompt are the mechanism, not an abstraction layered on top.
2. **Implement isolation as genuinely separate graph/agent invocations**,
   not a shared-state trick — the parent should only ever receive a summary,
   never the child's raw working context.
3. **Structure context assembly as explicit, named steps/hooks**, not ad hoc
   string concatenation — this is what makes context flow debuggable and
   testable later.
4. **Add strategies incrementally, in response to diagnosed problems**, not
   preemptively all at once — this keeps the agent's architecture no more
   complex than it needs to be at each stage.