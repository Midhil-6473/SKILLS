# Model Routing — Sending Each Query to the Right-Priced Model

## The core idea

Not every query needs your most capable (and most expensive) model. A support
chatbot fielding "what's your return policy" alongside "my order arrived
damaged and I need a complex multi-step resolution" is wasting money if both
queries hit the same frontier model. **Model routing classifies incoming
requests and sends each to the cheapest model capable of handling it well** —
a well-tuned router can cut average per-query cost by 60-80% compared to
routing all traffic through a single premium model, with a typical enterprise
distribution looking something like 70% of queries to budget/local models,
20% to a mid-tier model, and 10% to a frontier model.

## The routing architecture

```
Incoming query
     │
     ▼
Classifier (cheap, fast — a small model, a rules engine, or an embedding
            similarity check against known query categories)
     │
     ├─→ Simple/routine query → Tier 1 (budget model, e.g. a small open-weight
     │                                    or "-mini"-class model)
     ├─→ Moderate complexity  → Tier 2 (mid-tier model)
     └─→ Complex/high-stakes  → Tier 3 (frontier model)
```

**The classifier itself must be cheap** — if classification costs nearly as
much as just calling the frontier model directly, routing provides no net
benefit. Options range from a lightweight rules/keyword-based classifier (an
FAQ-lookup pattern, a specific intent match) to a small dedicated
classification model, to an embedding-similarity check against a labeled set
of example queries — vendors report routing overhead well under 40ms,
meaning routing generally doesn't meaningfully affect user-perceived latency.

## Confidence-gated escalation — a practical routing pattern

```python
def route_query(query: str) -> str:
    # Try the cheap model first
    cheap_response = call_model("budget-model", query)

    confidence = assess_confidence(cheap_response)   # a model-reported confidence
                                                        # score, a self-consistency
                                                        # check, or a classifier
    if confidence >= CONFIDENCE_THRESHOLD:
        return cheap_response

    # Escalate to a stronger model only when the cheap model wasn't confident
    return call_model("frontier-model", query)
```

This "try cheap first, escalate on low confidence" pattern (the approach
behind systems like RouteLLM) can reportedly achieve roughly 95% of
frontier-model quality at a 75-85% cost reduction — the key design choice is
the confidence threshold, which directly trades cost against the risk of
under-escalating a query that genuinely needed the stronger model. **Tune this
threshold empirically against your eval harness** (see this collection's
`ab-testing-experimentation` skill), not by intuition — too permissive a
threshold erodes quality silently, too conservative erodes the cost savings
you're routing for in the first place.

## Task-type routing — a simpler, rules-based alternative

```python
TASK_MODEL_MAP = {
    "faq_lookup": "budget-model",
    "status_check": "budget-model",
    "sentiment_classification": "budget-model",
    "summarization": "mid-tier-model",
    "complex_reasoning": "frontier-model",
    "code_generation": "frontier-model",
}

def route_by_task_type(task_type: str, query: str) -> str:
    model = TASK_MODEL_MAP.get(task_type, "mid-tier-model")   # a sane default
    return call_model(model, query)
```

For applications with well-defined, distinguishable task categories (a
support system with clear intents, a document-processing pipeline with known
document types), a simple lookup table is often more reliable and more
debuggable than a learned classifier — reach for confidence-gated escalation
specifically when task categories aren't cleanly separable in advance.

## Building vs. buying a router

| | Build your own | Use a routing product/gateway feature |
|---|---|---|
| Effort | Requires your own classifier + eval loop | Often built into an existing gateway (see `observability_and_finops.md`) |
| Control | Full control over thresholds, categories, fallback logic | Constrained by the product's routing model |
| Best for | Well-understood, narrow task distributions where you can tune precisely | Getting a reasonable default quickly, or when you're already using a gateway for other reasons |

Many LLM gateways (LiteLLM and similar) include routing/fallback
functionality out of the box — often the pragmatic starting point, with a
custom classifier justified once you have enough traffic and enough
eval-harness maturity to tune routing precisely for your own task
distribution.

## Routing risk — the failure mode to actively guard against

The central risk of any routing system is **silent quality degradation on
misrouted queries** — a genuinely complex query that gets classified as
simple and routed to a budget model produces a worse (but not obviously
broken) response, which can go unnoticed without deliberate monitoring.
Mitigations:

1. **Maintain a held-out eval set spanning your full difficulty range**, and
   re-run it whenever routing logic changes — exactly the discipline covered
   in this collection's `pydantic-architect` (`observability_and_evals.md`)
   and `ab-testing-experimentation` skills.
2. **Track quality metrics segmented by routing tier**, not just in
   aggregate — a quality drop isolated to the budget-tier segment is a
   distinct, actionable signal that aggregate metrics can mask.
3. **Log routing decisions** alongside outcomes, so misrouting can be
   diagnosed after the fact, not just suspected.

## Practical guidance

1. **Ensure the classifier itself is cheap** — a routing layer that costs
   nearly as much as the model it's trying to avoid provides no real benefit.
2. **Use confidence-gated escalation for ambiguous task distributions**,
   simple rules-based routing for well-defined, separable task categories.
3. **Tune routing thresholds against a real eval harness**, not intuition —
   this is a quality/cost trade-off that needs to be measured, not guessed.
4. **Track quality by routing tier, not just in aggregate**, to catch silent
   degradation on misrouted queries specifically.
5. **Start with a gateway's built-in routing** before building a custom
   classifier, unless you already have the traffic volume and eval maturity
   to justify the extra engineering.