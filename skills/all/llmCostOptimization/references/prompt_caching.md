# Prompt Caching — The Highest-Leverage, Lowest-Risk Cost Lever

## Why this is the first thing to implement

Prompt caching offers up to **~90% off cached input tokens on Anthropic** and
**~50% off on OpenAI**, for content that's genuinely being reused across
calls — this is described across the field as "the highest-leverage,
lowest-risk cost reduction available" precisely because it requires no model
swap, no quality trade-off, and no new infrastructure — just correct prompt
*structure*. Most teams are not using it optimally, which is exactly why it's
worth checking first, before anything else on this skill's list of levers.

## How it actually works, mechanically

On each request, the provider checks whether the **leading portion** of your
prompt matches a prefix it processed recently. That prefix typically holds
your system instructions, tool definitions, few-shot examples, and any static
grounding/reference data. **On a match, the provider reads the stored
key-value representations directly from memory instead of recomputing
them** — this is what makes the cached portion dramatically cheaper.

**The hard rule this implies**: caching works on an **exact prefix match**.

```
Static content (system prompt, tool defs, few-shot examples, static docs)
  ↓ THIS PART SHOULD GO FIRST, and stay byte-for-byte identical across calls
Variable content (conversation history, retrieved RAG chunks that differ per query)
  ↓
The user's live query
  ↓ THIS GOES LAST, always
```

**Change a single word anywhere in the prefix, and every token after that
point loses its cache eligibility for that call.** This is why prompt
structure — not prompt *content* — is the actual engineering discipline here:
static content first, dynamic content last, and keep anything
call-specific (timestamps, session IDs, randomized ordering) OUT of the
cacheable prefix entirely.

## Anthropic's `cache_control` — explicit cache breakpoints

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "You are a customer support agent for Acme Corp...",   # static
        },
        {
            "type": "text",
            "text": large_static_knowledge_base_text,                        # static, large
            "cache_control": {"type": "ephemeral"},                            # mark the cache boundary here
        },
    ],
    messages=[
        {"role": "user", "content": user_query},   # dynamic — never cached
    ],
)

# Check actual cache performance from the response
print(response.usage.cache_creation_input_tokens)   # tokens written to cache this call
print(response.usage.cache_read_input_tokens)         # tokens read from cache this call (the discount)
```

**Anthropic charges a write premium (roughly 1.25x-2x base input cost) the
first time content is cached** — this means caching only pays off financially
once the cached prefix is large enough and reused enough times within the
cache's retention window to amortize that initial write cost. A cached
prefix used only once provides no benefit and a real cost penalty; a cached
prefix reused across dozens of calls within the retention window is where the
~90% discount actually accrues.

## OpenAI's automatic caching

```python
# OpenAI activates caching AUTOMATICALLY once a prompt reaches 1,024+ tokens
# — no explicit cache_control markup needed, but the same prefix-ordering
# discipline still applies for the automatic matching to succeed
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[
        {"role": "system", "content": static_system_prompt},   # keep this identical across calls
        {"role": "user", "content": user_query},
    ],
)
print(response.usage.prompt_tokens_details.cached_tokens)   # how many input tokens hit the cache
```

OpenAI bills cached input at roughly one-tenth the standard rate once the
1,024-token minimum is met — the mechanism is automatic, but **the same
static-first, dynamic-last structuring discipline is still required** for
the automatic prefix match to actually succeed; automatic doesn't mean
structure-agnostic.

## The breakeven calculation — should you even bother caching this?

```python
def caching_worth_it(
    cached_prefix_tokens: int,
    reuse_count: int,
    write_premium_multiplier: float = 1.5,   # Anthropic-style write premium
    cache_discount: float = 0.9,               # 90% off on read
) -> bool:
    cost_without_caching = cached_prefix_tokens * reuse_count   # (in token-cost units)
    cost_with_caching = (cached_prefix_tokens * write_premium_multiplier) + \
                         (cached_prefix_tokens * (1 - cache_discount) * (reuse_count - 1))
    return cost_with_caching < cost_without_caching
```

**Rule of thumb**: caching becomes worthwhile once you have a reasonably
large static prefix reused at least a handful of times within the cache
retention window — a small prefix used once is a net loss on providers with
a write premium; a large prefix (a long system prompt, a big tool
definition set, a static knowledge base excerpt) reused across many calls in
a conversation or across many users is where the savings compound
dramatically.

## Monitoring cache performance — don't assume, verify

```python
# Wire cache hit rate into your observability (see observability_and_finops.md) —
# a silent hit-rate regression is a silent cost regression
CACHE_HIT_RATE = cache_read_tokens / (cache_read_tokens + cache_creation_tokens)

if CACHE_HIT_RATE < 0.5:   # threshold depends on your specific traffic pattern
    alert("Cache hit rate dropped — check for a recent prompt structure change")
```

**A single careless change — adding a timestamp near the top of the prompt,
reordering few-shot examples, injecting session-specific data into the
"static" block — can silently collapse your cache hit rate** from something
like 80% down to single digits, with no error or warning, just a larger
invoice. Treat cache hit rate as a first-class metric to monitor and alert
on, exactly like error rate or latency.

## Semantic caching — a distinct, complementary technique

Prompt caching (above) requires an **exact prefix match**. **Semantic
caching** is a different, application-level technique: embedding each query
and checking similarity against previously-seen queries, returning a cached
*response* for a semantically similar (not identical) query — bypassing the
model call entirely on a hit, saving both input and output tokens rather than
just input. This is covered in depth in
`semantic_caching_and_compression.md`, since it involves different
infrastructure (a vector store, a similarity threshold) and different risk
considerations (a "close enough" match can occasionally return a genuinely
wrong-for-this-query cached response) than provider-level prefix caching.
**Expect a mature 2026 production stack to layer both** — exact prefix
caching and semantic caching are not competing choices.

## Practical guidance

1. **Implement prompt caching first, before any other lever in this skill** —
   it's the highest-leverage, lowest-risk option, and most teams aren't using
   it well.
2. **Structure every prompt static-first, dynamic-last**, and keep anything
   truly call-specific out of the "static" block entirely — this ordering
   discipline is the entire mechanism.
3. **Check the breakeven math before caching a small or rarely-reused
   prefix** — caching isn't free on providers with a write premium, and a
   prefix used only once is a net cost, not a saving.
4. **Monitor cache hit rate as a first-class metric**, with alerting — a
   silent regression here is a silent cost regression, and it's caused by
   exactly the kind of small, easy-to-miss prompt change that happens
   routinely during normal development.
5. **Treat semantic caching as complementary to, not a replacement for,**
   exact prefix caching — production stacks increasingly layer both.