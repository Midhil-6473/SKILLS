# Model Selection — Right-Sizing, Open-Weight Models, Self-Hosting

## Don't default to the most capable model available

The most common, most avoidable cost mistake: using a frontier flagship
model for every task by default, "just to be safe," without checking whether
a smaller/cheaper model performs adequately. **Right-sizing** means matching
model capability to task difficulty — deliberately, and validated against an
eval harness, not by habit.

```
Simple, well-defined tasks (classification, extraction, FAQ-style Q&A,
  short-form formatting) → a small/budget model is very often sufficient

Moderate reasoning, longer-form generation, domain-specific nuance
  → a mid-tier model

Complex multi-step reasoning, high-stakes decisions, frontier-level
  code generation, ambiguous open-ended tasks
  → a frontier model, where the capability premium is actually earned
```

**This is the same judgment call underlying model routing**
(`model_routing.md`) — right-sizing is the static, design-time version of the
same idea; routing is the dynamic, per-request version.

## Open-weight models — a genuinely disruptive cost lever

Open-weight model families (Llama, Qwen, DeepSeek, GLM, Kimi, and others)
can run **15-30x cheaper per token** than frontier proprietary models when
accessed via a cheap inference provider or self-hosted — for tasks that don't
specifically require frontier-only capability, this is one of the largest
single cost levers available, and one that's improved substantially as
open-weight model quality has closed much of the gap with proprietary
frontier models on many practical tasks.

```python
# Using an open-weight model via a low-cost hosted inference provider,
# through a unified interface (see observability_and_finops.md for LiteLLM)
response = litellm.completion(
    model="together_ai/Qwen/Qwen2.5-72B-Instruct",   # illustrative — check current provider offerings
    messages=[{"role": "user", "content": query}],
)
```

**Evaluate open-weight models the same way you'd evaluate any model
swap** — against your real eval harness on your real task distribution, not
against a generic public benchmark leaderboard, since leaderboard rankings
don't always predict performance on your specific task shape.

## When self-hosting actually pays off

Self-hosting (see this collection's `docker-k8s-mlops` skill for the
infrastructure side, and `unsloth-finetuning` if a fine-tuned open-weight
model is part of the plan) trades a per-token API cost for a fixed
infrastructure cost (GPU instances, whether cloud-rented or owned) — this
only pays off **at genuinely high, sustained volume**, or when data
residency/compliance requirements make third-party API calls unacceptable
regardless of cost.

```
Rough mental model:
Low/moderate, variable volume  → API-based access (open-weight or proprietary)
                                   almost always wins; you pay only for what
                                   you use, no idle infrastructure cost
High, sustained, predictable volume → self-hosting can win, once volume is
                                        high enough that fixed GPU cost per
                                        unit time is lower than the
                                        equivalent API spend
Data residency / compliance requirement → self-hosting may be required
                                            regardless of the cost comparison
```

**Don't self-host purely for the theoretical per-token savings without doing
the actual breakeven math** — self-hosting adds real operational burden
(uptime, scaling, GPU provisioning, model updates) that has its own cost,
covered by this collection's `docker-k8s-mlops` skill; the breakeven point is
usually higher in practice than a naive per-token comparison suggests once
that operational cost is included.

## Model selection checklist

Before defaulting to (or continuing to use) a given model for a task, check:

1. **Has a cheaper model actually been evaluated on this task**, with real
   eval data — or is the current choice just "the model we started with"?
2. **Does the task genuinely require frontier-level capability** (complex
   multi-step reasoning, nuanced judgment, cutting-edge code generation), or
   would a mid-tier/open-weight model perform adequately?
3. **Is an open-weight model a viable option** for this specific task, given
   current open-weight model quality on tasks resembling yours?
4. **Does volume/compliance justify evaluating self-hosting**, or is
   API-based access clearly the simpler, cheaper choice at current scale?

## Practical guidance

1. **Treat "which model" as a decision to actively validate**, not a
   default to inherit — re-evaluate periodically as both your task
   understanding and the model landscape evolve.
2. **Evaluate open-weight models against your own eval harness**, not
   generic leaderboards, before ruling them out for a task.
3. **Do the actual self-hosting breakeven math**, including operational
   cost, before assuming it's cheaper than API access at your current volume.
4. **Right-sizing and routing are the same idea at different time scales** —
   apply the same "does this task actually need this much capability"
   question whether you're choosing a model once at design time or per-request
   at runtime.