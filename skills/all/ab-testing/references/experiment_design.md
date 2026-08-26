# Experiment Design — Hypotheses, Randomization, Sample Size

## Start with a written hypothesis, not just an idea

```
Bad:  "Let's test a green button vs. a blue button."

Good: "We believe changing the CTA button from blue to green will increase
click-through rate, because user research suggests the current blue blends
into the page background and reduces visual salience. We expect at least a
5% relative improvement in CTR. If this doesn't materialize, we'll conclude
button color isn't a meaningful lever for this page and move on to testing
copy instead."
```

A written hypothesis forces three things that prevent wasted experiments: a
clear **mechanism** (why would this work?), a **specific predicted effect
size** (which drives your sample size calculation), and a **pre-committed
interpretation** for both outcomes (what will you do whether it wins or
loses?) — without this last part, teams frequently rationalize a losing test
after the fact rather than accepting the result.

## Choosing the randomization unit

| Unit | Use when |
|---|---|
| **User ID** | The standard default — consistent experience per user across sessions, the right choice for most product experiments |
| **Session** | When the change is session-scoped and user-level consistency doesn't matter (rare) |
| **Device / Cookie** | When you can't reliably identify logged-out users any other way — accept some noise from users switching devices |
| **Cluster (e.g., account, geography)** | When the treatment could plausibly affect other users in the same cluster (network effects, shared accounts) — using individual-user randomization here causes **interference/spillover**, biasing results |

**Interference is a genuinely common, under-recognized source of bad
experiment results**: if you randomize individual users on a feature with
network effects (a marketplace, a social feature, a collaborative tool), a
treatment user's behavior can affect control users in the same network,
contaminating the comparison. When network effects are plausible, randomize at
the cluster level (e.g., by geographic market, or by team/account) instead of
by individual user.

## Choosing your primary metric

**One primary metric, decided before launch.** Supporting/secondary metrics
and guardrails (see `metrics_and_pitfalls.md`) can be tracked alongside it, but
the primary metric is what determines ship/no-ship — deciding this after
seeing results is exactly the p-hacking pattern warned about in `SKILL.md`.

A good primary metric is:
- **Sensitive** — actually moves in response to the kind of change you're
  testing (a metric that's noisy or rarely changes makes detecting real
  effects require an impractically large sample).
- **Directly tied to the hypothesis** — not a distant proxy three steps removed
  from what you actually changed.
- **Not trivially gameable** — a metric your team could inflate without
  delivering real value (e.g., "clicks" when the real goal is "successful
  task completion") produces a technically-significant result that doesn't
  represent genuine improvement.

## Sample size and power calculation

The four inputs every sample size calculation needs:

1. **Baseline conversion rate / metric value** — your current, pre-experiment
   number.
2. **Minimum Detectable Effect (MDE)** — the smallest relative or absolute
   change worth detecting; smaller MDE requires a larger sample.
3. **Significance level (α)** — typically 0.05.
4. **Statistical power (1-β)** — typically 0.80 (an 80% chance of detecting a
   real effect of the specified MDE, if one exists).

```python
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import proportion_effectsize

baseline_rate = 0.10          # current 10% conversion rate
mde_relative = 0.05           # detect a 5% relative lift (10% -> 10.5%)
treatment_rate = baseline_rate * (1 + mde_relative)

effect_size = proportion_effectsize(treatment_rate, baseline_rate)
analysis = NormalIndPower()
sample_size_per_group = analysis.solve_power(
    effect_size=effect_size, alpha=0.05, power=0.80, ratio=1.0
)
print(f"Required sample size per group: {sample_size_per_group:.0f}")
```

**The MDE choice is the most consequential, most-often-mishandled input.**
Setting MDE too small (wanting to detect a tiny 1% lift) demands an enormous
sample size, often making the test impractically slow — but setting MDE too
large just because it's convenient means the test genuinely can't detect
effects smaller than that threshold, even if such an effect would be
practically meaningful to the business. Choose MDE based on the smallest
effect that would actually change a shipping decision, not on what's
statistically convenient.

## Calculate expected test duration BEFORE launching

```python
daily_eligible_traffic = 5000          # users per day entering the experiment
required_sample_per_group = 15000       # from the calculation above
num_groups = 2
total_required = required_sample_per_group * num_groups

days_needed = total_required / daily_eligible_traffic
print(f"Estimated test duration: {days_needed:.1f} days")
```

**Run this calculation before launch, and commit to that duration (or a
principled early-stopping method — see `advanced_techniques.md`).** A test
duration decided in advance, based on the power calculation, is what makes
"stop when the result reaches significance" (see `statistical_analysis.md`'s
peeking section) an invalid, bias-introducing practice rather than a
reasonable-sounding shortcut.

## A minimum test duration, even with ample power

Even when your traffic gives you enough sample size for statistical power in
2-3 days, **run for at least one full week** (ideally covering at least one
full business cycle — often 1-2 weeks) to average out day-of-week effects
(weekday vs. weekend behavior can differ substantially) and to let novelty
effects begin to settle (see `metrics_and_pitfalls.md`). A statistically
"powered" but too-short test can still give a misleading result due to
these confounds.

## Practical guidance

1. **Write the hypothesis, predicted effect size, and pre-committed
   interpretation before building anything** — this single habit prevents the
   most common experimentation failure mode (rationalizing a loss after the
   fact).
2. **Randomize at the cluster level whenever network effects/interference are
   plausible** — individual-user randomization silently biases results in
   these cases.
3. **Choose exactly one primary metric before launch**, sensitive, directly
   tied to the hypothesis, and not trivially gameable.
4. **Calculate sample size and duration using a real MDE tied to a shipping
   decision**, not statistical convenience.
5. **Run for at least a full week regardless of when power is technically
   reached**, to average out day-of-week and early novelty effects.