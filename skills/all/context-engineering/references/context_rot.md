# Context Rot — Why Longer Context Doesn't Mean Better Performance

## The core finding

**Context rot**: LLM accuracy drops as context length grows, **even when all
information the model needs remains present and technically within the
window**. This is a distinct phenomenon from simply "running out of room" —
research has measured degradations in the range of roughly 14% to 85%
depending on the specific task, purely from context length effects, with the
relevant information never removed. This means the naive fix for a
long-running agent's degrading behavior — "just give it a bigger context
window" — treats the wrong problem. A bigger window raises the ceiling before
you hit a hard token limit; it does not fix the underlying attention
degradation that happens well before that ceiling.

## Why this happens (the intuition, not the full mechanism)

Attention mechanisms in transformer models don't weight every token in a
long context equally or perfectly — as the number of tokens grows, the
model's ability to correctly locate, weigh, and use the *specific* relevant
information among everything else in context degrades, particularly for
information effectively "buried" in the middle of a long context (as opposed
to the very beginning or very end, which tend to receive more reliable
attention — an effect sometimes called "lost in the middle"). This is a
property of how these models currently process long sequences, not a bug
specific to any one provider or model family, though the degree of
degradation varies by model and improves somewhat with each model
generation.

## Real production evidence

Anthropic's own multi-agent research system found that **token usage
explains roughly 80% of performance variance** on a difficult benchmark
(BrowseComp) — more than model choice or number of tool calls combined. This
is a striking, concrete result: **how much context an agent is carrying, not
which model is running it, was the dominant factor in whether the agent
succeeded.** This is the single strongest piece of evidence that context
management is a primary performance lever in its own right, not a secondary
concern behind model selection.

## What this means practically

```
A full context window is not a neutral "we have room" state — quality can
already be measurably degrading well before you hit any hard token limit.

The old mental model:          The context-rot-aware mental model:
"We have 200K tokens,          "Every additional token has a real,
 we're using 50K, we're        measurable attention cost — the question
 fine."                        isn't 'do we fit' but 'is this token worth
                                its share of the model's attention budget
                                right now.'"
```

**Design implication**: don't wait until an agent hits a context limit or
starts visibly failing to start managing context — build the four core
strategies (`SKILL.md`) into the agent's architecture from the start, the
same way you wouldn't wait for a server to run out of memory before thinking
about memory management at all.

## Recognizing context rot in your own agent

Signs an agent may be suffering from context rot, distinct from a genuine
capability gap:

- **Performance degrades over the course of a long session** even though the
  task hasn't gotten harder — early turns were handled well, later turns of
  the same conversation show more errors or inconsistency.
- **The agent "forgets" or contradicts something established earlier** in
  the same session, despite that information technically still being present
  in the context.
- **Adding more context (more retrieved documents, more tool output, more
  history) to try to help the agent makes performance worse, not better** —
  a strong signal that the *volume* of context, not a lack of information,
  is the actual problem.
- **The same task performed as a fresh, short conversation succeeds
  reliably, but fails intermittently when embedded deep in a long session** —
  isolate the variable (session length) to confirm this is a context issue
  rather than a genuine task-difficulty issue.

## The reframe: context as a finite, high-signal resource

The core discipline, in Anthropic's own framing: **finding the smallest set
of high-signal tokens that maximizes the likelihood of your desired
outcome** — not the largest set of potentially-relevant tokens. This is a
genuine mindset shift from "more context can only help" (intuitive, and
wrong past a point) to "every token has a real attention cost, so context is
something to curate, not just accumulate."

## Practical guidance

1. **Never assume a bigger context window solves a long-running agent's
   reliability problems on its own** — it raises the ceiling, it doesn't fix
   the underlying attention degradation that happens well before that
   ceiling.
2. **Watch for degradation over the course of a session**, not just
   capability gaps on a fixed task — this is the specific signature of
   context rot, distinct from the model simply being unable to do something.
3. **Treat "adding more context makes it worse" as a diagnostic signal**, not
   a paradox — it's exactly what context rot predicts, and it should redirect
   effort toward curation (Select/Compress — see the corresponding reference
   files) rather than more retrieval or more history.
4. **Design for context management from the start of agent architecture**,
   not as a reactive fix once an agent visibly starts failing on long
   sessions.