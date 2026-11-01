# Measuring and Debugging Context

## Instrument before you optimize

The same principle from this collection's `llm-cost-optimization` skill
applies directly here: **you cannot manage what you can't see.** Before
applying any of the four strategies, know your agent's actual context
breakdown — where tokens are going, at which turn compaction/degradation
starts becoming visible, and which component (system prompt, tool
definitions, history, tool results) dominates.

## A basic context breakdown

```python
def measure_context_breakdown(messages: list, system_prompt: str, tools: list) -> dict:
    return {
        "system_prompt_tokens": count_tokens(system_prompt),
        "tool_definitions_tokens": sum(count_tokens(t.schema) for t in tools),
        "message_history_tokens": sum(count_tokens(m["content"]) for m in messages),
        "tool_result_tokens": sum(
            count_tokens(m["content"]) for m in messages if m["role"] == "tool"
        ),
        "total_tokens": count_tokens(system_prompt) + sum(count_tokens(t.schema) for t in tools)
                       + sum(count_tokens(m["content"]) for m in messages),
    }
```

**Run this at multiple points across a session** (turn 5, turn 15, turn 30),
not just once — the *trend* (is tool-result token count growing linearly with
turns? Is message history growing faster than expected?) is more diagnostic
than a single snapshot, and it's exactly what tells you whether you're
looking at a conversation-bloat problem or a tool-result-bloat problem (see
the diagnosis table in `compress_strategies.md`).

## The diagnostic framework — mapping symptoms to the right lever

| Observation | Likely diagnosis | Reference file |
|---|---|---|
| Performance degrades over a long session even without more information being needed | Context rot from volume, not a missing-information problem | `context_rot.md` |
| Tool result tokens dominate the breakdown and grow with turn count | Tool-result bloat | `compress_strategies.md` (tool-result clearing), `select_strategies.md` (return references, not full results) |
| Message history dominates and conversation is long/discursive | Conversation bloat | `compress_strategies.md` (compaction) |
| A rule/convention established early gets violated after many turns | Compaction eroded something that needed to survive intact | `write_strategies.md` (move it to a persistent memory file) |
| A single agent handling multiple independent subtasks shows declining quality on later subtasks | Missing isolation — context accumulating across unrelated subtasks | `isolate_strategies.md` |
| Adding more retrieved context/documents makes answers worse, not better | Low signal-to-noise ratio, a context rot symptom | `select_strategies.md` (tighter retrieval), `context_rot.md` |

## Turn-count heuristics — when to start worrying

A commonly-cited practical guideline: **start monitoring context health from
around turn 5**, and by **turn 8-10, most agent conversations benefit from at
least partial compression** (keeping the most recent 2-3 turns verbatim,
compressing what's older). This is a starting heuristic to validate against
your own workload, not a universal law — a task with very short, simple
turns can go longer before compression matters; a task with large tool
outputs per turn may need it sooner.

## Observability tooling

The 2026 agent observability landscape has matured specifically to support
this kind of context-level debugging — platforms including Langfuse,
LangSmith, Arize Phoenix, Braintrust, Datadog LLM Observability, MLflow, and
Opik now offer visibility into individual steps of an agent's trajectory,
not just aggregate request/response logging. For the cost-tracking side of
this same tooling landscape, see this collection's `llm-cost-optimization`
skill (`observability_and_finops.md`) — the two concerns (cost observability
and context observability) frequently share the same underlying
instrumentation, since both need per-step, per-token visibility into what an
agent actually did.

```python
# What to actually log per step, for context-engineering debugging specifically
log_agent_step(
    step_number=step_num,
    context_breakdown=measure_context_breakdown(messages, system_prompt, tools),
    compaction_triggered=did_compact_this_step,
    sub_agent_spawned=sub_agent_name if applicable else None,
    tool_calls_this_step=[t.name for t in tool_calls],
)
```

## A/B testing context engineering changes

Changes to context strategy (a new compaction threshold, a tighter retrieval
count, a new sub-agent boundary) are exactly the kind of change this
collection's `ab-testing-experimentation` skill's discipline applies to:
**measure task success rate and output quality before and after a context
strategy change**, using a real held-out set of representative tasks — not
just "it feels like it's working better now." A context change that reduces
token cost but silently degrades task success rate is not a win; the only
way to know the difference is to measure both together.

## Testing compaction/clearing configuration against real workload patterns

```python
def test_compaction_preserves_critical_info(agent, critical_fact: str, filler_turns: int = 20):
    """A concrete regression test: does information established early in a
    conversation survive a compaction event, or silently disappear?"""
    session = agent.start_session()
    session.send(f"Remember this: {critical_fact}")
    for _ in range(filler_turns):
        session.send("Continue with unrelated small talk or filler tasks.")
    session.trigger_compaction()   # or just let it happen naturally at the threshold
    response = session.send("What was the important fact I told you earlier?")
    assert critical_fact.lower() in response.lower(), "Compaction lost critical information"
```

Writing this kind of test *before* shipping a compaction configuration
change — not just trusting the default — is the concrete way to validate the
"what survives compaction" question from `compress_strategies.md`, rather
than discovering the failure mode in production.

## Practical guidance

1. **Measure context breakdown at multiple points across a session**, not
   just once — the trend is what's diagnostic.
2. **Use the symptom-to-lever diagnostic table** before applying a fix —
   context engineering has several distinct failure modes, and the correct
   response differs by which one you're actually facing.
3. **Start monitoring from early turns (around turn 5)**, not only once a
   problem is already visible.
4. **A/B test context strategy changes against real task success metrics**,
   not just token count or intuition — a cheaper context strategy that
   quietly degrades quality is not actually an improvement.
5. **Write concrete regression tests for what should survive compaction** —
   don't assume a default compaction configuration correctly preserves what
   your specific agent needs.