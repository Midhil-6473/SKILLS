# Beginner → Advanced Learning Path (LLM Cost Optimization)

Use this as a curriculum when the user wants a structured roadmap rather than
a point answer. Each phase names the reference file(s) to pull detail from,
building toward one cumulative cost-optimization project.

## Phase 0 — Orientation (20 minutes)

- Understand the input/output token price asymmetry (5-8x) and why it should
  shape where you look for savings first. See `SKILL.md`.
- Learn the five-lever priority order (caching → batching → routing →
  model selection → semantic caching/compression) and why that order
  minimizes engineering effort and quality risk for the savings captured.

**Practice:** Take an AI feature you've built (from any other skill in this
collection) and estimate its current monthly cost using the formula in
`token_economics.md`, even roughly — this becomes your baseline for the rest
of the learning path.

## Phase 1 — Token Economics

*Read: `references/token_economics.md`*

1. Break down a real request from your Phase 0 feature into its token
   components (system prompt, tools, history, query, response).
2. Identify which component is largest, and whether it's growing unboundedly
   (especially conversation history).
3. Check whether any reasoning-token billing applies to your model choice.

**Practice:** Compute what your Phase 0 feature would cost at 10x and 100x
current volume, using the estimation function — this often surfaces a
structural problem (unbounded history growth, for instance) that isn't
visible at small scale.

## Phase 2 — Prompt Caching

*Read: `references/prompt_caching.md`*

1. Audit your Phase 0 feature's prompt structure — is static content first,
   dynamic content last?
2. Implement explicit cache breakpoints (Anthropic `cache_control`) or verify
   automatic caching is actually triggering (OpenAI, 1,024+ token minimum).
3. Compute the caching breakeven for your specific prefix size and expected
   reuse count.

**Practice project:** Restructure your Phase 0 feature's prompt for maximum
cache eligibility, and measure the actual cache hit rate before and after —
this is usually the single highest-impact change in the entire learning
path.

## Phase 3 — Model Routing and Selection

*Read: `references/model_routing.md` + `references/model_selection.md`*

1. Classify your feature's typical queries into difficulty tiers.
2. Design (even on paper) a routing scheme — task-type-based or
   confidence-gated — for your feature.
3. Evaluate whether an open-weight model would be viable for your simplest
   query tier, using your eval harness.

**Practice project:** Implement a simple task-type or confidence-gated router
for your Phase 0 feature, routing at least one query category to a cheaper
model, and validate quality didn't regress using a small eval set.

## Phase 4 — Semantic Caching and Compression

*Read: `references/semantic_caching_and_compression.md`*

1. Assess whether your feature has genuinely static, repeatable answers
   (a good semantic-caching fit) or personalized/dynamic content (a poor
   fit).
2. If RAG-based, check your current `top_k` and reranking strategy through a
   cost lens, not just a quality lens.

**Practice:** If your feature is RAG-based, measure token cost before and
after adding a rerank-and-trim step — quantify both the cost saving and any
quality change.

## Phase 5 — Batch APIs

*Read: `references/batching_and_async.md`*

1. Identify any part of your workload (or a plausible future part) that
   doesn't need a real-time response — reports, bulk classification, eval
   runs, RAG index enrichment.
2. Sketch the async pipeline architecture (job submission, polling/webhook,
   result processing) such a workload would need.

**Practice:** If you maintain an eval suite (see this collection's
`ab-testing-experimentation` or `pydantic-architect` skills), estimate the
cost saving from running it through a batch endpoint instead of real-time
calls.

## Phase 6 — Agentic and RAG-Specific Costs

*Read: `references/agentic_and_rag_costs.md`*

1. If your feature is agentic, count the actual number of LLM calls per
   typical user interaction — not the demo case, a realistic one.
2. Audit tool definitions for prunability and conciseness.
3. If using multi-agent patterns, explicitly justify the cost multiplier
   against the parallelism benefit for your specific use case.

**Practice project:** For an agentic feature, trace one full multi-step
interaction and compute the total token cost across every step — most
people are surprised by how much of the total comes from re-paid context on
later steps.

## Phase 7 — Observability and FinOps

*Read: `references/observability_and_finops.md`*

1. Set up at least gateway-level tracking (LiteLLM or equivalent) for your
   project, even a minimal local setup.
2. Add cache-hit-rate and cost-per-request tracking as explicit metrics, not
   just total spend.
3. Set up one basic spend-anomaly alert.

**Practice project:** Wire your Phase 0-6 project into a minimal
observability setup (even a simple logging table, if not a full platform)
tracking cost, cache hit rate, and model tier per request — this closes the
loop from "we optimized cost" to "we can prove and monitor that we optimized
cost."

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer
managing a real production AI budget):
- Build on one cumulative project (an AI feature from any other skill in
  this collection) across all phases, rather than disconnected examples.
- Emphasize Phase 2 (prompt caching) as the single highest-value phase if
  time is limited — it's genuinely the "if you only do one thing" lever
  the field consistently points to.
- Check understanding with a concrete estimation exercise before advancing —
  e.g., "given this prompt structure, would you expect a high or low cache
  hit rate, and why?"
- Always pair any optimization exercise with an explicit quality check
  (even informal) — the habit of "measure quality before AND after every
  cost change" is more valuable long-term than mastering any single
  technique in isolation.