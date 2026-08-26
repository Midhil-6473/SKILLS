# Beginner → Advanced Learning Path (A/B Testing & Experimentation)

Use this as a curriculum when the user wants a structured roadmap rather than
a point answer. Each phase names the reference file(s) to pull detail from,
building toward one cumulative practice project.

## Phase 0 — Orientation (20 minutes)

- Understand why random assignment is what makes A/B testing different from
  "we changed something and a metric moved" — this is the single idea
  everything else builds on. See `SKILL.md`.
- Learn the core vocabulary table (p-value, power, MDE, Type I/II error) well
  enough to recognize each term when it comes up.

**Practice:** Write, in your own words, why "we shipped X and revenue went up
the next month" is not the same kind of evidence as "we ran a randomized
A/B test and treatment beat control with p=0.02."

## Phase 1 — Experiment Design

*Read: `references/experiment_design.md`*

1. Write a full hypothesis (mechanism + predicted effect size + pre-committed
   interpretation) for a hypothetical product change.
2. Practice choosing a randomization unit for a few different scenarios,
   including one with plausible network effects.
3. Run a sample size calculation using the provided Python snippet, and
   compute expected test duration from a hypothetical traffic volume.

**Practice project:** Pick a real or hypothetical product change, write the
full hypothesis, choose a primary metric and guardrails, and calculate
required sample size and duration — this becomes your project spec for the
rest of the learning path.

## Phase 2 — Statistical Analysis

*Read: `references/statistical_analysis.md`*

1. Practice stating a p-value's correct interpretation out loud, and
   contrast it with the common incorrect version.
2. Compute a confidence interval for a hypothetical conversion-rate
   difference using the provided snippet.
3. Understand peeking, multiple comparisons, and Simpson's Paradox well
   enough to spot each in a described scenario.

**Practice:** Given a fabricated dataset (or your Phase 1 project's
simulated data), compute the p-value and confidence interval, and write
both a correct and a common-incorrect interpretation side by side to
internalize the distinction.

## Phase 3 — Metrics and Pitfalls

*Read: `references/metrics_and_pitfalls.md`*

1. Define guardrail metrics for your Phase 1 project, not just the primary
   metric.
2. Run the SRM check snippet against a fabricated observed split, both a
   clean 50/50-ish split and a deliberately skewed one, and confirm the
   check flags the skewed one.
3. Sketch what a novelty-effect decay curve would look like for your
   project's hypothesis, and decide in advance how you'd detect it.

**Practice project:** Add guardrail metrics and an SRM check to your Phase 1
project spec — a "complete" experiment design, not just a primary-metric
plan.

## Phase 4 — Advanced Techniques

*Read: `references/advanced_techniques.md`*

1. Identify whether your Phase 1 project's primary metric has a plausible
   pre-experiment covariate CUPED could exploit.
2. Understand the sequential-testing trade-off (average-case cost vs.
   robustness to MDE misestimation) well enough to decide when you'd use it.
3. Work through when a multi-armed bandit would fit better than a
   traditional A/B test, using a concrete example distinct from your main
   project.

**Practice:** Write a one-paragraph justification for whether your Phase 1
project should use fixed-horizon testing, sequential testing, or a bandit —
and why.

## Phase 5 — AI/ML and LLM Experimentation

*Read: `references/ai_ml_experimentation.md`*

1. Understand the offline-eval-vs-online-A/B-testing distinction well enough
   to explain why a model that wins offline can still lose (or be
   inconclusive) online.
2. Design metrics (quality proxy, engagement, cost-per-outcome, latency) for
   a hypothetical LLM feature change.
3. Understand why deterministic hashing for variant assignment matters
   specifically for AI/agent experiments.

**Practice project:** If you've built anything from this collection's other
AI skills (a RAG chatbot, an agent), design a full online A/B test for a
hypothetical improvement to it — model swap, prompt change, or new tool —
including cost-per-outcome as a tracked metric.

## Phase 6 — Platforms and Implementation

*Read: `references/platforms_and_implementation.md`*

1. Compare GrowthBook, Statsig, and Eppo/Datadog against your own
   hypothetical team's situation (warehouse maturity, team size, risk
   tolerance around the 2025 acquisitions) and decide which you'd pick, or
   whether DIY is more appropriate.
2. Implement the deterministic variant-assignment function and try assigning
   a handful of test user IDs to confirm consistency across repeated calls.
3. Write the SQL analysis query pattern against a fabricated exposures +
   outcomes schema.

**Practice project:** Implement a minimal DIY experimentation pipeline
(assignment function + logging schema + analysis query) for your Phase 1
project — this is the artifact that proves you understand the full
mechanics, not just the theory.

## Phase 7 — Running a Program

*Read: `references/running_a_program.md`*

1. Score 3-5 hypothetical product ideas using ICE, and discuss why the
   ranking might differ from gut instinct.
2. Write a complete experiment report for your Phase 1-6 project, following
   the report structure in this file — including the SRM check and guardrail
   results, even if simulated/hypothetical.

**Practice project:** Produce the final report — this is the capstone
artifact for the whole learning path, demonstrating the complete pipeline
from hypothesis through design, execution, and a defensible, complete
write-up.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer
running real production experiments):
- Build one cumulative project (a single hypothetical or real product/AI
  change) across all phases rather than disconnected examples.
- Emphasize Phase 2's correct p-value interpretation and Phase 3's SRM check
  as the two habits most worth over-practicing — they're the most commonly
  botched in real-world applied A/B testing, and getting them right by
  instinct is more valuable than memorizing every advanced technique.
- Check understanding with a "spot the mistake" exercise before advancing —
  e.g., "here's a made-up experiment report with a subtle peeking problem in
  it — can you find it?"
- If the learner is specifically preparing for a data science / growth /
  product analytics interview, weight time toward Phases 1-3 (the
  fundamentals most commonly tested) before Phases 4-6 (the more
  specialized/advanced material).