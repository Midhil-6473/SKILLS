# Beginner → Advanced Learning Path (Context Engineering)

Use this as a curriculum when the user wants a structured roadmap rather than
a point answer. Each phase names the reference file(s) to pull detail from,
building toward one cumulative agent whose context flow is progressively
engineered — mirroring the worked example in `implementation_patterns.md`.

## Phase 0 — Orientation (20 minutes)

- Understand the prompt engineering vs. context engineering distinction —
  "how to ask" vs. "what does the agent know, see, and remember." See
  `SKILL.md`.
- Understand context rot: longer context can mean worse performance, even
  when nothing relevant is missing.
- Learn the Write/Select/Compress/Isolate taxonomy well enough to categorize
  any specific technique into one of the four buckets.

**Practice:** Take an agent you've built from this collection's
`langchain-architect`, `pydantic-architect`, or `mcp-architect` skills, and
predict where it would first show context problems if run for 50+ turns.

## Phase 1 — Context Rot

*Read: `references/context_rot.md`*

1. Understand why the fix isn't just "use a bigger context window."
2. Learn to recognize the specific symptoms (degradation over session
   length, "adding more context makes it worse") that distinguish context
   rot from a genuine capability gap.

**Practice:** If you have access to an agent with a long-running
conversation, deliberately extend it well past normal length and observe
whether quality on a repeated simple task degrades — this makes context rot
concrete rather than theoretical.

## Phase 2 — Write Strategies

*Read: `references/write_strategies.md`*

1. Implement a basic scratchpad (even a simple dict or file) for an agent
   to write intermediate findings to.
2. Create a persistent memory file (AGENTS.md-style) with 3-5 genuine, hard
   constraints for a project.
3. Distinguish what belongs in persistent memory vs. what belongs in a
   session-scoped scratchpad.

**Practice project:** Pick an agent from your existing work and add a
plan.md-style file it writes its overall plan to before starting subtasks —
this becomes the base for the rest of the learning path's cumulative
project.

## Phase 3 — Select Strategies

*Read: `references/select_strategies.md`*

1. Convert one tool that returns large output into one that saves the
   result externally and returns a short reference instead.
2. Audit your agent's tool list — are all tools always exposed, or could
   some be scoped to specific phases/roles?

**Practice project:** Modify your Phase 2 project's most output-heavy tool
(a search tool, a file-read tool) to return a reference instead of inlining
the full result, and measure the token difference.

## Phase 4 — Compress Strategies

*Read: `references/compress_strategies.md`*

1. Diagnose whether your project's bloat (if any, at this stage) would come
   from conversation history or tool results specifically.
2. Implement a basic compaction trigger (even a simple token-count
   threshold calling a summarization step).
3. Implement tool-result clearing for old, no-longer-needed tool outputs.
4. Write the compaction regression test from `measuring_and_debugging.md` —
   confirm a fact established early survives your compaction
   implementation.

**Practice project:** Add compaction to your Phase 2-3 project, and run the
"does a critical fact survive compaction" test against it — if it fails,
that's the direct evidence for why the fact belongs in a persistent memory
file instead (back to Phase 2).

## Phase 5 — Isolate Strategies

*Read: `references/isolate_strategies.md`*

1. Identify a genuinely independent subtask in your project that could be
   delegated to an isolated sub-agent.
2. Implement the context-isolation-with-summary-return pattern for that
   subtask.
3. Size the sub-agent's return summary and compare it against the
   1,000-2,000 token heuristic.

**Practice project:** Split your project's most complex step into a
lead-agent-plus-sub-agent structure, with the sub-agent handling an
independent piece of work and returning only a condensed summary — measure
whether the lead agent's context grows more slowly as a result.

## Phase 6 — Implementation Patterns

*Read: `references/implementation_patterns.md`*

1. If using LangGraph, map your project's Write/Select fields onto explicit
   state schema fields rather than ad hoc variables.
2. Review the worked v0→v4 example and identify which version your own
   project most resembles at this point in the learning path.

**Practice:** Refactor your project's context assembly into named, explicit
steps (a `build_context()` function with clear stages) rather than
implicit string concatenation scattered through the code — this is the
"observable and testable" principle made concrete.

## Phase 7 — Measuring and Debugging

*Read: `references/measuring_and_debugging.md`*

1. Implement the context breakdown measurement function and run it at
   several points across a long session with your project.
2. Set up basic logging of context health per agent step.
3. Design (even informally) an A/B comparison of your project before and
   after one context engineering change, checking task success rate, not
   just token count.

**Practice project:** Produce a before/after context breakdown report for
your cumulative project — system prompt tokens, tool definition tokens,
history tokens, tool-result tokens — comparing the naive Phase 0 version
against the fully context-engineered Phase 5-6 version.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer
optimizing a production long-running agent):
- Build one cumulative agent across all phases, following the worked
  v0→v4 progression in `implementation_patterns.md` as the concrete shape
  of the project.
- Emphasize the Write/Select/Compress/Isolate taxonomy as the thing most
  worth internalizing deeply — once a learner can correctly categorize a
  novel technique into one of the four buckets, they can reason about new
  context engineering problems without needing to memorize every specific
  technique.
- Check understanding with a diagnostic exercise before advancing — e.g.,
  "here's a description of an agent's symptoms — which of the four
  strategies would you reach for first, and why?"
- Connect explicitly to this collection's other agent-building skills
  (`langchain-architect`, `pydantic-architect`, `mcp-architect`) — context
  engineering is not a replacement for those skills' agent-building
  guidance, it's the layer that determines whether an agent built with them
  stays reliable as it runs longer and does more.