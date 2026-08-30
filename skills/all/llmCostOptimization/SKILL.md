---
name: llm-cost-optimization
description: >
  Complete manual for optimizing the cost of LLM and AI applications in
  production — token economics, prompt caching, semantic caching, model
  routing, prompt compression, batch APIs, and cost observability/FinOps. Use
  whenever the user asks about reducing LLM API costs, prompt caching
  (Anthropic/OpenAI cache_control), semantic caching, model routing between
  cheap and expensive models, token usage optimization, batch API pricing,
  self-hosting open-weight models for cost reasons, LiteLLM/Langfuse/Helicone
  for cost tracking, budget controls and alerts, or how to bring down a
  ballooning AI API bill without hurting quality. Also trigger for beginner
  questions like why LLM APIs are priced the way they are, why output tokens
  cost more than input tokens, or how to estimate what a new AI feature will
  cost before shipping it.
---

# The LLM Cost Optimization Manual

You are acting as an expert AI cost/FinOps engineer. As of 2026, per-token
prices have fallen roughly 80% year over year — and enterprise LLM API spend
has still more than doubled, because usage volume is growing faster than
prices are falling. This is the defining paradox of AI economics right now:
**cost optimization isn't a one-time fix, it's an ongoing engineering
discipline**, on par with performance optimization or security — not
something you do once and forget.

## Token economics — the pricing model everything else builds on

```
Total cost per request ≈ (input tokens × input price) + (output tokens × output price)
```

**Output tokens typically cost 5-8x more than input tokens** across major
providers — a fact with real architectural consequences: a verbose system
prompt is expensive, but a model that rambles in its *responses* is far more
expensive per token. This asymmetry should directly shape where you focus
optimization effort — controlling output length and avoiding
unnecessary generation (retries, multi-step chains that could be one call)
usually has more leverage than input-side trimming alone.

## The five levers, and the order to apply them

Applying these roughly in this order captures the most savings for the least
engineering effort and quality risk:

1. **Prompt caching** — up to ~90% off cached input tokens (Anthropic), ~50%
   off (OpenAI). The single highest-leverage, lowest-risk lever available;
   most teams under-use it. See `references/prompt_caching.md`.
2. **Batch APIs** — ~50% off for workloads that don't need a real-time
   response. See `references/batching_and_async.md`.
3. **Model routing** — send easy queries to cheap/small models, hard queries
   to frontier models. A well-tuned router can cut average per-query cost
   60-80% relative to routing everything through one premium model. See
   `references/model_routing.md`.
4. **Right-sizing the model itself** — including open-weight models (Llama,
   Qwen, DeepSeek, GLM, Kimi) that can run 15-30x cheaper per token than
   frontier proprietary models for tasks that don't need frontier
   capability. See `references/model_selection.md`.
5. **Semantic caching and prompt compression** — catching near-duplicate
   queries and trimming redundant context. Real savings, but with more
   quality risk than the levers above if implemented carelessly. See
   `references/semantic_caching_and_compression.md`.

**None of this is safe without an evaluation harness** (see this collection's
`pydantic-architect` and `ab-testing-experimentation` skills) — every lever
here trades some risk of quality regression for cost savings, and the only
way to know you haven't crossed that line is to measure quality before and
after, not assume it.

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Token economics: pricing models, where tokens actually go, estimating cost before shipping | `references/token_economics.md` |
| Prompt caching in depth: Anthropic vs. OpenAI mechanics, cache-friendly prompt structure, the breakeven math | `references/prompt_caching.md` |
| Model routing: classification-based routing, confidence-gated escalation, building vs. buying a router | `references/model_routing.md` |
| Model selection: right-sizing, open-weight vs. proprietary, when self-hosting actually pays off | `references/model_selection.md` |
| Semantic caching and prompt compression: application-level caching, LLMLingua-style compression, context window management | `references/semantic_caching_and_compression.md` |
| Batch APIs and async processing: when to use them, the workloads that fit | `references/batching_and_async.md` |
| Agentic and RAG-specific cost patterns: multi-agent cost multipliers, RAG context cost, tool-call economics | `references/agentic_and_rag_costs.md` |
| Cost observability and FinOps: LiteLLM, Langfuse, budget controls, the three-layer tool stack, cost attribution | `references/observability_and_finops.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Instrument before you optimize.** You cannot optimize what you can't
   measure — know your cost breakdown by request type, model, and feature
   before touching anything. Guessing which lever will help wastes the
   engineering effort the levers are meant to save.
2. **Never optimize cost without an eval harness catching quality
   regressions** — every lever in this skill (routing, caching, compression,
   smaller models) can silently degrade quality if pushed too far; the only
   defense is measuring, not assuming.
3. **Attack caching and batching before routing or model swaps** — they carry
   the least quality risk and, in most systems, the largest easy win, since
   most teams aren't using caching optimally in the first place.
4. **Structure prompts for caching from day one**: static content (system
   prompt, tool definitions, few-shot examples) first, variable content (the
   user's actual query) last — this single ordering discipline is the
   difference between a 90% cache hit rate and a 7% one.
5. **Treat output token count as a first-class cost lever**, not an
   afterthought — given the 5-8x price asymmetry, constraining unnecessary
   verbosity often matters more than input-side trimming.
6. **Track cost per successful outcome, not just raw spend** — a cheaper
   model that requires more retries or produces worse results that drive
   support escalations can be more expensive overall than a pricier model
   that gets it right the first time. (See this collection's
   `ab-testing-experimentation` skill for the metric-design discipline this
   builds on.)
7. **Separate the three tool layers**: a gateway (enforces budgets/routes in
   real time), an observability tool (attributes cost after the fact), and a
   FinOps layer (budgets, chargeback, forecasting) — don't expect one tool to
   do all three well by default.
8. **Source of truth: provider pricing pages change frequently.** Token
   prices, cache discount rates, and batch API terms are moving targets —
   web-search current pricing before making a specific cost claim or
   recommendation, rather than relying on a remembered number.