# Token Economics — Pricing Models, Where Tokens Go, Estimating Cost

## How LLM APIs are priced

```
Cost = (input_tokens / 1,000,000 × input_price_per_million)
     + (output_tokens / 1,000,000 × output_price_per_million)
```

Nearly every commercial LLM API prices per-million-tokens, separately for
input and output — and **output tokens typically cost 5-8x more than input
tokens**. This asymmetry is the single fact that should most shape your
mental model of where cost actually comes from: a system prompt that's twice
as long costs you something, but a model that generates twice as much output
per response costs you far more, all else equal.

## Where tokens actually go — a full request's anatomy

```
System prompt (instructions, persona, formatting rules)
+ Tool/function definitions (every tool schema, in full, on every call)
+ Retrieved context (RAG chunks, documents)
+ Conversation history (every prior turn, resent on every new turn unless
  you're using a stateful API feature)
+ The user's actual query
= Total input tokens

Model's response
+ Any "thinking"/reasoning tokens (for models that expose or bill for these)
= Total output tokens
```

**Conversation history is a commonly underestimated cost driver**: a chatbot
that resends the full conversation on every turn has cost that grows
roughly quadratically with conversation length (turn N re-sends turns 1
through N-1 as input) — a 20-turn conversation costs dramatically more in
cumulative input tokens than twenty independent 1-turn conversations would,
even though the user experience feels like "one conversation." This is
exactly what prompt caching (`prompt_caching.md`) is designed to address, and
exactly why it's the highest-leverage lever available.

**Tool definitions are a similarly underestimated fixed cost**: every tool
schema you give an agent (see this collection's `langchain-architect`,
`pydantic-architect`, and `mcp-architect` skills) is resent as input on every
single call, whether or not that tool is actually used in that turn. An
agent with 15 verbose tool definitions pays for all 15 on every request,
including ones that never get called.

## Estimating cost before shipping a feature

```python
def estimate_monthly_cost(
    requests_per_day: int,
    avg_input_tokens: int,
    avg_output_tokens: int,
    input_price_per_million: float,
    output_price_per_million: float,
) -> dict:
    daily_input_cost = (requests_per_day * avg_input_tokens / 1_000_000) * input_price_per_million
    daily_output_cost = (requests_per_day * avg_output_tokens / 1_000_000) * output_price_per_million
    daily_total = daily_input_cost + daily_output_cost
    return {
        "daily_cost": daily_total,
        "monthly_cost": daily_total * 30,
        "input_share": daily_input_cost / daily_total,
        "output_share": daily_output_cost / daily_total,
    }

# Example: a support chatbot doing 10,000 conversations/day
estimate = estimate_monthly_cost(
    requests_per_day=10_000,
    avg_input_tokens=2_000,     # system prompt + tools + history + query
    avg_output_tokens=300,
    input_price_per_million=3.00,     # ILLUSTRATIVE — check current provider pricing
    output_price_per_million=15.00,
)
```

**Always run this estimate before shipping a new AI feature**, not after the
first invoice arrives — the inputs (expected request volume, average
token counts per request) are usually knowable in advance from a handful of
manual test calls, and a back-of-envelope projection routinely surfaces cost
problems (like unbounded conversation history growth, or an
unexpectedly-verbose default response length) while they're still cheap to
fix in design rather than expensive to fix after scale.

## Reasoning/"thinking" tokens — a distinct cost category

Models with extended reasoning/thinking capabilities may generate and bill
for internal reasoning tokens separately from the final visible answer —
this can substantially increase output token counts for a given user-facing
response length. When using a reasoning-capable model, **check whether
reasoning tokens are billed, and at what rate**, and consider whether the
task genuinely needs extended reasoning or whether a non-reasoning
model/mode would perform adequately at lower cost — not every task justifies
the reasoning-token premium.

## Cost asymmetry as a design principle

Given the 5-8x output-vs-input price gap, several design choices become
clearly cost-favorable, independent of any caching/routing optimization:

- **Prefer structured, constrained output formats** (a specific JSON schema,
  a bounded set of categories) over open-ended free text where the task
  allows it — shorter, more predictable output directly reduces the more
  expensive side of the cost equation.
- **Set explicit `max_tokens` limits** appropriate to the task, rather than
  leaving generation effectively unbounded — a runaway or repetitive
  generation is a real, avoidable cost risk, not just a latency one.
- **Avoid multi-step chains that could be one call** where quality allows —
  each additional LLM call in a chain re-pays the input cost of context and
  potentially compounds output cost, so collapsing an unnecessary two-call
  pattern into one well-designed call is a real, structural saving (though
  never at the cost of correctness — see `agentic_and_rag_costs.md` for
  where multi-step really is justified).

## Practical guidance

1. **Internalize the input/output price asymmetry** — it should influence
   where you look for savings first (output length/verbosity) as much as
   input-side optimization (caching, compression).
2. **Estimate cost before shipping**, using real sample requests to measure
   average token counts, not a guess.
3. **Watch conversation history and tool-definition overhead specifically**
   — both are commonly underestimated, silently-compounding cost drivers.
4. **Check whether reasoning tokens are billed separately** for any
   reasoning-capable model in use, and confirm the task actually needs that
   capability.
5. **Design for output brevity where the task allows it** — structured
   formats and explicit `max_tokens` limits are cheap, low-risk wins.