# A/B Testing for AI/ML and LLM Products

## Offline evaluation and online A/B testing answer different questions

This is the single most important framing for experimentation on AI/ML
systems: **offline evaluation** (benchmark datasets, RAGAS/DeepEval-style
metrics, the eval approaches in this collection's `pydantic-architect` and
`llm-agent-security` skills) tells you whether a model/prompt performs well
against a fixed test set, quickly and cheaply, before anything reaches real
users. **Online A/B testing** tells you whether it actually improves *real
user outcomes* in production — engagement, task completion, retention,
revenue — which offline metrics can only approximate. **Neither replaces the
other**: offline eval is a fast, cheap filter for candidates before they earn
real traffic; online A/B testing is the actual validation that a change
helps the business or the user, since offline metrics can improve while real
user outcomes stay flat or even worsen (e.g., a model that scores better on a
benchmark but produces responses real users find less useful in practice, or
a "more helpful"-scoring model that's also slower in a way users dislike more
than they value the improved helpfulness).

```
Model/Prompt Change
       │
       ▼
Offline Eval (cheap, fast, fixed test set)
  → Faithfulness, relevancy, accuracy on a benchmark
  → Filters out clearly bad candidates before spending real traffic on them
       │
       ▼ (only candidates that pass offline eval move forward)
Online A/B Test (expensive, slow, real users)
  → Does this actually improve real user outcomes and business metrics?
  → The only way to know for certain — offline metrics are a proxy, not a guarantee
```

## What's different about experimenting on AI/ML systems specifically

1. **Non-determinism** — the same input can produce different outputs across
   calls (especially at higher temperature), adding noise beyond normal user
   behavior variance; this generally means AI/ML experiments need somewhat
   larger sample sizes than an equivalent deterministic feature change, all
   else equal.
2. **Cost is a first-class metric, not just a guardrail** — a new model or
   longer prompt can improve quality while meaningfully increasing per-request
   cost; track cost-per-outcome (not just raw cost) as a metric alongside
   quality and engagement metrics.
3. **Latency directly affects the metric you care about** — a slower but
   "better" model can lose on engagement simply because users bounce during
   the wait, confounding the comparison between output quality and response
   speed; consider these as at least partially separate levers.
4. **Quality itself is often unmeasurable via a simple event** — unlike a
   click or a purchase, "was this response good" frequently needs either
   explicit user feedback (thumbs up/down, a rating) or a downstream proxy
   (did the user re-ask the same question, did they continue the
   conversation, did they abandon) rather than a single unambiguous
   conversion event.

## Metrics for LLM/agent product experiments

| Category | Example metrics |
|---|---|
| **Quality proxies** | Thumbs up/down rate, conversation continuation rate, re-ask/rephrase rate (a high rate suggests the first answer didn't satisfy the user), explicit ratings |
| **Engagement/outcome** | Task completion rate, session length, return-usage rate, conversion (if applicable to the product) |
| **Cost** | Cost per conversation/request, cost per successful outcome (a more meaningful denominator than raw request cost) |
| **Latency** | Time to first token, total response time, perceived latency (streaming can improve perceived latency without changing actual completion time) |
| **Guardrails (AI-specific)** | Refusal rate, safety-flag rate, hallucination-flag rate (if you have a detection mechanism), escalation-to-human rate |

**Cost-per-successful-outcome is frequently the most decision-relevant metric
and the most commonly missing one** — a model upgrade that's 30% more
expensive per request but doubles task completion rate is very likely worth
it; the same cost increase with no completion-rate improvement is not. Report
cost normalized by outcome, not as a standalone number, whenever comparing
model or prompt variants.

## Practical patterns for online model/prompt testing

```python
# A common pattern: route a percentage of production traffic to a candidate
# model/prompt, using the same infrastructure as any other feature flag /
# A/B test (see platforms_and_implementation.md)

import random

def get_model_variant(user_id: str) -> str:
    # Deterministic hashing ensures the SAME user always gets the SAME variant
    # across multiple requests/sessions — critical for a coherent experience
    # and for valid analysis (mixing variants within one user muddies results)
    bucket = hash(user_id) % 100
    if bucket < 10:
        return "candidate_model_v2"     # 10% of traffic
    return "production_model_v1"         # 90% of traffic

# Log EVERY request with its variant, outcome signals, cost, and latency —
# this is the raw data the eventual statistical analysis runs on
log_experiment_event(
    user_id=user_id, variant=get_model_variant(user_id),
    latency_ms=response_time, cost_usd=token_cost,
    outcome_signal=user_feedback,   # thumbs up/down, continuation, etc.
)
```

**Deterministic hashing for variant assignment is essential**, not optional —
a user randomly re-assigned to a different model on every request makes both
the product experience incoherent and the statistical analysis invalid (you'd
be mixing within-user variance across variants in a way that breaks the clean
between-group comparison the whole method depends on).

## Staged rollout — a pattern specific to higher-risk AI changes

For agent/AI changes with real risk (see this collection's
`llm-agent-security` skill for the risk categories this addresses), combine
A/B testing with a staged rollout rather than jumping straight to a large
traffic percentage:

```
Stage 1: 1% traffic, heavy monitoring, short window (catch catastrophic issues fast)
Stage 2: 5-10% traffic, standard A/B analysis begins accumulating real signal
Stage 3: 50% traffic, full statistical comparison, guardrail metrics closely tracked
Stage 4: 100% rollout, OR rollback, based on the accumulated evidence
```

This connects directly to this collection's `docker-k8s-mlops` skill
(canary rollouts in Kubernetes/KServe) and `llm-agent-security` skill
(the principle of staged, monitored deployment for risk-bearing changes) —
the experimentation framing and the deployment-safety framing are two lenses
on the same staged-rollout practice, not separate concerns.

## Why "vibes-based" LLM evaluation isn't enough for a real product decision

Manually trying a new prompt/model on a handful of examples and forming an
impression ("this feels better") is a reasonable first filter — but it's
exactly the kind of small-sample, no-randomization, no-statistical-control
comparison this entire skill exists to move beyond. **Use qualitative
impression as a cheap first pass to decide whether a candidate is even worth
formal offline eval and online testing** — never as the basis for a real
production decision on its own, for exactly the reasons covered in
`statistical_analysis.md` (small samples and informal comparison are highly
susceptible to noise, novelty, and confirmation bias).

## Practical guidance

1. **Treat offline eval and online A/B testing as sequential, complementary
   stages**, not alternatives — offline eval filters cheaply, online testing
   validates against real outcomes.
2. **Track cost-per-outcome, not raw cost, as a first-class metric** for any
   model/prompt comparison.
3. **Use deterministic hashing for variant assignment** — the same user must
   consistently see the same variant across requests.
4. **Combine A/B testing with staged rollout for risk-bearing agent/AI
   changes** — this connects the experimentation and deployment-safety
   disciplines rather than treating them separately.
5. **Never treat informal qualitative impression as sufficient for a real
   product decision** — use it only as a cheap filter before formal
   evaluation.