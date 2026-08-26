---
name: ab-testing-experimentation
description: >
  Complete manual for A/B testing and experimentation — designing, running, and
  correctly interpreting controlled experiments for products and AI/ML systems.
  Use whenever the user asks about A/B testing, statistical significance, sample
  size calculation, experiment design, hypothesis testing for products, p-values,
  confidence intervals, guardrail metrics, sequential testing, CUPED, novelty
  effects, sample ratio mismatch, multi-armed bandits, or how to know if a model,
  prompt, or feature change actually improved things in production. Also covers
  experimentation platforms (GrowthBook, Statsig, Eppo) and LLM/AI-specific
  experimentation (online model/prompt comparison, offline eval vs. online A/B
  testing). Trigger for beginner questions like what an A/B test is, why a result
  might not be statistically significant, or how experimentation differs from
  just trying something and looking at the numbers.
---

# The A/B Testing & Experimentation Manual

You are acting as an expert experimentation/growth engineer and applied
statistician. This skill covers the full discipline of causal experimentation —
not "we changed something and a number went up," but designing a test that can
actually attribute an observed change to the change you made, with a known,
quantified risk of being wrong.

## Why "just look at the numbers" isn't enough

If you ship a change and a metric goes up the following week, you don't
actually know the change *caused* the improvement — it could be a weekday
effect, a marketing campaign, seasonality, or pure random noise. A/B testing
solves this with **random assignment**: users are randomly split into groups
that experience different versions, so — assuming the split is truly random and
large enough — the *only* systematic difference between groups is the change
being tested. This is what lets you say "this change caused this effect," not
just "this metric moved after this change," and it's the entire reason
experimentation is a distinct discipline from plain analytics.

## The core vocabulary, in one pass

| Term | Meaning |
|---|---|
| **Control / Treatment (A / B)** | The unchanged baseline vs. the variant being tested |
| **Null hypothesis (H₀)** | "There is no real difference between control and treatment" — what you're trying to disprove |
| **p-value** | The probability of seeing a result this extreme (or more) *if the null hypothesis were true* — NOT the probability the null hypothesis is true |
| **Statistical significance (α)** | A pre-chosen threshold (typically 0.05) for how small the p-value must be before you reject the null |
| **Statistical power (1-β)** | The probability of correctly detecting a real effect, if one exists (typically targeted at 80%) |
| **Minimum Detectable Effect (MDE)** | The smallest effect size you've designed the experiment to reliably detect |
| **Type I error** | A false positive — concluding there's an effect when there isn't one |
| **Type II error** | A false negative — missing a real effect because the test lacked power |

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Experiment design: hypotheses, randomization units, sample size/power calculation, MDE | `references/experiment_design.md` |
| Statistical analysis: p-values/confidence intervals interpreted correctly, frequentist vs. Bayesian, common statistical mistakes | `references/statistical_analysis.md` |
| Metrics: primary vs. guardrail metrics, novelty/primacy effects, sample ratio mismatch (SRM), segmentation pitfalls | `references/metrics_and_pitfalls.md` |
| Advanced techniques: CUPED variance reduction, sequential testing, multi-armed bandits | `references/advanced_techniques.md` |
| A/B testing for AI/ML/LLM products specifically: online model/prompt comparison, offline eval vs. online testing, LLM-specific guardrails | `references/ai_ml_experimentation.md` |
| Experimentation platforms: GrowthBook, Statsig, Eppo — what they do, how to choose, and how to build your own with plain SQL/Python | `references/platforms_and_implementation.md` |
| Running the experimentation program: prioritization, culture, reading/writing a trustworthy experiment report | `references/running_a_program.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Calculate sample size and expected test duration BEFORE launching**, not
   after — deciding how long to run a test based on when the result "looks
   significant" is exactly the mistake that invalidates the whole exercise (see
   "peeking," in `statistical_analysis.md`).
2. **Pick your primary metric before launching, and stick to it.** Checking many
   metrics and reporting whichever one happens to be significant (multiple
   comparisons / "p-hacking") produces false positives at a much higher rate
   than your nominal significance threshold suggests.
3. **Always monitor guardrail metrics alongside your primary metric** — a
   feature that improves engagement while quietly increasing latency, error
   rate, or unsubscribes is not a clean win (see `metrics_and_pitfalls.md`).
4. **Check for Sample Ratio Mismatch (SRM) before trusting any result** — if
   your control/treatment split doesn't match the intended ratio (e.g., you
   configured 50/50 but observed 52/48 far beyond chance), something is broken
   in your randomization or logging, and the result is not trustworthy
   regardless of what the p-value says.
5. **A p-value tells you about the null hypothesis, not the probability your
   change is good** — "p < 0.05" means "if there were truly no effect, we'd see
   data this extreme less than 5% of the time," not "there's a 95% chance the
   treatment is better." Misinterpreting this is the single most common
   statistical error in applied A/B testing.
6. **Don't stop a test early just because it looks significant**, and don't
   extend a test that "almost" reached significance — both practices inflate
   your true false-positive rate well above your nominal threshold, unless you're
   using a testing method specifically designed for early stopping (sequential
   testing — see `advanced_techniques.md`).
7. **For AI/ML systems specifically, offline evaluation and online A/B testing
   answer different questions and neither replaces the other** — offline eval
   (see this collection's other AI skills) tells you if a model/prompt performs
   well on a benchmark; online A/B testing tells you if it actually improves
   real user outcomes. See `ai_ml_experimentation.md`.
8. **Statistical significance is not the same as practical/business
   significance** — a genuinely real effect can still be too small to matter
   for the business; always report effect size and confidence interval, not
   just a significant/not-significant verdict.