# Metrics and Pitfalls — Guardrails, Novelty Effects, Sample Ratio Mismatch

## Primary metrics vs. guardrail metrics

**Primary metric**: the single metric that determines ship/no-ship (see
`experiment_design.md`). **Guardrail metrics**: metrics that must NOT get
meaningfully worse, even if the primary metric improves — latency, error
rate, unsubscribe rate, support ticket volume, revenue, and similar.

```
A feature that improves click-through rate by 8% (primary metric: WIN) while
increasing page load time by 400ms and unsubscribe rate by 2% (guardrails:
FAIL) is not a clean ship decision — it's a trade-off requiring a genuine
product/business judgment call, not an automatic green light from the
primary metric alone.
```

**Always define your guardrail metrics before launch**, alongside the primary
metric — deciding after the fact which metrics count as guardrails invites the
same p-hacking-adjacent bias as choosing your primary metric after seeing
results.

## Novelty and primacy effects — why early results can mislead

**Novelty effect**: users respond differently to something purely because
it's *new*, not because it's actually better — a redesigned UI might see an
initial engagement spike from curiosity/exploration that fades within days to
weeks as the change becomes routine. **Primacy effect**: the reverse — users
initially resist a change (friction from having to relearn a familiar
pattern) even though it's genuinely an improvement, with the negative effect
fading as they adjust.

```
Effect size over time:
Day 1-3:   +15% (novelty inflating the apparent effect)
Day 4-7:   +9%
Day 8-14:  +4%
Day 15+:   +3% (the more durable, "true" long-run effect)
```

**Detecting this**: plot the treatment effect over time (not just a single
aggregate number for the whole test) and look for a decaying (novelty) or
rising (primacy) trend rather than a flat line. If you see clear decay/rise
that hasn't leveled off by the time your pre-calculated sample size is
reached, **extend the test** specifically to let the effect stabilize — a
common practical guideline is designing for roughly double the
power-calculated duration when novelty effects are plausible, to cover
several "half-lives" of the expected decay. Segmenting by new vs. returning
users is also diagnostic — a novelty effect concentrated in returning users
(who've seen the "old" version and are reacting to the change itself) versus
a stable effect in new users (who have no baseline to compare against) is a
strong novelty signal.

## Sample Ratio Mismatch (SRM) — the check to run before trusting anything

**SRM**: your observed control/treatment split doesn't match your configured
split, by more than chance would explain. If you configured a 50/50 split and
observe 5,200 vs. 4,800 users, is that normal random variation, or a sign
something is broken?

```python
from scipy.stats import chisquare

observed = [5200, 4800]           # actual counts in control vs. treatment
expected_ratio = [0.5, 0.5]         # your configured split
total = sum(observed)
expected = [total * r for r in expected_ratio]

chi2, p_value = chisquare(observed, expected)
print(f"SRM check p-value: {p_value:.6f}")
# A p-value below ~0.001 (a stricter threshold than the usual 0.05, since
# SRM checks are run routinely and false alarms are costly) signals a
# real ratio mismatch, not just noise
```

**If SRM is detected, DO NOT trust the experiment's results, no matter how
compelling the primary metric looks.** SRM indicates something is broken in
randomization, logging, or eligibility criteria — common causes: a bug
causing one variant to fail to load for some users (who then get excluded
from being counted, but only in one arm), inconsistent bucketing between the
assignment system and the analytics system, or a redirect/caching layer
treating variants differently. **Always run the SRM check first**, before
looking at the primary metric at all — a significant primary-metric result
built on top of an undetected SRM problem is not a real, trustworthy effect.

## Segmentation pitfalls

```python
# Tempting but dangerous: slicing results by many post-hoc segments looking
# for ANY segment where the effect is significant
for segment in ["mobile", "desktop", "new_users", "returning_users",
                 "US", "EU", "APAC", "high_value", "low_value", ...]:
    # testing each segment separately inflates false-positive rate exactly
    # like the multiple-comparisons problem in statistical_analysis.md
    ...
```

**Pre-register any segments you plan to analyze**, for the same reason you
pre-register your primary metric — otherwise, a "we found a significant
effect in mobile users in the EU" finding, discovered by slicing the data
enough ways, is very likely to be noise, not a real, actionable segment
effect. If a genuinely interesting unplanned segment effect emerges, treat it
as a *hypothesis for a follow-up experiment* specifically designed and
powered to test that segment, not as a standalone conclusion.

## Metric dilution

If a feature only affects a small fraction of your user base (e.g., a change
to a rarely-visited settings page) but you measure its effect against an
overall metric computed across your *entire* user base, the real effect gets
diluted by all the unaffected users in the denominator — potentially making a
genuinely large effect on the affected subgroup look statistically
undetectable in the aggregate. **Measure effects on the population actually
eligible/exposed to the change**, not your full user base, whenever exposure
is partial.

## Practical guidance

1. **Define guardrail metrics before launch**, with the same rigor as your
   primary metric — an experiment that only tracks one number invites blind
   spots.
2. **Plot the effect over time, not just a single test-end number**, to catch
   novelty/primacy effects before they distort your conclusion.
3. **Run the SRM check first, always**, before trusting any other result from
   the experiment.
4. **Pre-register any segments you intend to analyze** — treat unplanned
   "interesting segment" findings as hypotheses for follow-up experiments, not
   conclusions.
5. **Measure effects against the exposed/eligible population**, not the full
   user base, when exposure to the treatment is partial.