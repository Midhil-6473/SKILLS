# Running an Experimentation Program — Prioritization, Culture, Reporting

## Prioritizing what to test — ICE and similar frameworks

With limited traffic and engineering time, not every idea can be tested at
once. **ICE** (Impact, Confidence, Ease) is a simple, widely-used scoring
framework for prioritization:

```python
def ice_score(impact: int, confidence: int, ease: int) -> float:
    """Each scored 1-10. Higher total = higher priority."""
    return (impact + confidence + ease) / 3

ideas = [
    {"name": "New onboarding flow", "impact": 8, "confidence": 6, "ease": 4},
    {"name": "Button color change", "impact": 2, "confidence": 8, "ease": 9},
    {"name": "AI-powered recommendations", "impact": 9, "confidence": 4, "ease": 3},
]
for idea in ideas:
    idea["score"] = ice_score(idea["impact"], idea["confidence"], idea["ease"])
ideas.sort(key=lambda x: x["score"], reverse=True)
```

**The value of ICE (or similar frameworks like PIE — Potential, Importance,
Ease) is less about the precise numeric score and more about forcing an
explicit conversation** about impact, confidence, and effort before committing
engineering time to a test — a low-confidence, low-impact idea that's easy to
build isn't necessarily worth testing just because it's cheap.

## Experiment collision and interaction effects

Running many concurrent experiments risks **interaction effects** — two
simultaneous experiments touching related parts of the product can interfere
with each other's results, making both harder to interpret cleanly.

**Mitigations**:
- **Mutual exclusion groups** — ensure experiments touching the same user
  flow/surface don't run on overlapping user populations simultaneously.
- **Orthogonal experiment layers** — a common pattern (used by large-scale
  experimentation programs) where experiments are organized into independent
  "layers" (e.g., a UI layer, a ranking-algorithm layer, a pricing layer),
  with users randomized independently within each layer — this allows many
  concurrent experiments across different layers with a much lower risk of
  interaction, since experiments within the same layer are the ones
  specifically prevented from overlapping.
- **Explicit interaction checks** for experiments you know touch related
  surfaces, even across layers, when there's a specific reason to suspect
  interference.

## Writing a trustworthy experiment report

A report that lets a reader trust the conclusion (not just accept a headline
number) should include, at minimum:

1. **The hypothesis and pre-registered primary metric** — stated as it was
   before launch, not reframed after seeing results.
2. **Sample size, duration, and confirmation the SRM check passed.**
3. **The primary metric result** with effect size AND confidence interval,
   not just a significant/not-significant verdict.
4. **Guardrail metric results** — explicitly, even if "no meaningful change,"
   not omitted because they weren't the headline finding.
5. **Effect-over-time plot** — to rule out (or characterize) novelty/primacy
   effects.
6. **Segment results**, if pre-registered, with a clear note that any
   *unplanned* segment findings are hypotheses for follow-up, not conclusions.
7. **The ship/no-ship recommendation and reasoning** — including how
   guardrail trade-offs were weighed, not just "primary metric won, therefore
   ship."

**A report missing the SRM check or guardrail metrics should be treated as
incomplete, regardless of how compelling the primary-metric headline number
looks** — this is the practical, everyday enforcement of the principles in
`statistical_analysis.md` and `metrics_and_pitfalls.md`.

## Building an experimentation culture

- **Normalize losing tests.** A well-designed team's experiments should have
  a healthy failure rate — commonly cited industry figures suggest only
  roughly a third or less of well-run experiments show a clear positive
  result. A near-100% "win rate" is a stronger signal of weak experimental
  rigor (biased metric selection, p-hacking, insufficiently novel ideas) than
  of genuinely exceptional product intuition.
- **Treat "no significant effect" as a real, useful finding**, not a wasted
  effort — knowing a change *doesn't* move the needle prevents the team from
  re-litigating the same idea repeatedly, and redirects effort toward ideas
  more likely to matter.
- **Separate the "did we learn something" question from the "did we
  win" question** — a rigorously-run test with a null result is a
  successful experiment even though it's not a "win," and conflating these
  two things pressures teams toward the exact bad practices (p-hacking,
  early stopping, metric shopping) this skill exists to prevent.
- **Make the pre-registration step lightweight but mandatory** — a one-page
  hypothesis + primary metric + guardrails + sample size document filed
  before launch, not a heavyweight process that discourages running tests at
  all.

## Practical guidance

1. **Use a lightweight prioritization framework (ICE or similar)** to make
   trade-offs explicit, rather than testing whatever's loudest in the room.
2. **Use experiment layers or mutual-exclusion groups** once running more
   than a couple of concurrent tests, to control interaction effects.
3. **Treat a report missing SRM checks or guardrail metrics as incomplete**,
   regardless of how good the headline result looks.
4. **Actively normalize and track null/losing results** as a sign of a
   healthy, rigorous program — not something to hide or minimize.
5. **Keep pre-registration lightweight but genuinely mandatory** — the goal
   is preventing post-hoc rationalization, not adding process for its own
   sake.