# Statistical Analysis — Correct Interpretation, Frequentist vs. Bayesian, Common Mistakes

## What a p-value actually means (and doesn't)

> A p-value is the probability of observing data this extreme (or more extreme),
> **assuming the null hypothesis is true**.

```
p = 0.03 means: "IF there were truly no difference between control and
treatment, we would see a result this extreme (or more extreme) only 3% of
the time due to random chance alone."

It does NOT mean:
- "There's a 97% chance the treatment is better" (this is a common,
  incorrect restatement — the p-value says nothing directly about the
  probability that either hypothesis is true)
- "The effect size is 3% off from zero" (unrelated to effect magnitude)
- "There's a 3% chance we're wrong to ship this" (conflates p-value with a
  posterior probability, which requires Bayesian reasoning to actually compute)
```

**This is the single most common statistical misinterpretation in applied A/B
testing** — worth stating explicitly and correcting every time it comes up,
since the intuitive-sounding wrong interpretation is genuinely easy to
default to.

## Confidence intervals — report these, not just significant/not-significant

```python
import numpy as np
from scipy import stats

control_conversions, control_total = 520, 5000
treatment_conversions, treatment_total = 580, 5000

p1 = control_conversions / control_total
p2 = treatment_conversions / treatment_total
diff = p2 - p1

se = np.sqrt(p1 * (1 - p1) / control_total + p2 * (1 - p2) / treatment_total)
ci_low, ci_high = diff - 1.96 * se, diff + 1.96 * se
print(f"Difference: {diff:.4f}, 95% CI: [{ci_low:.4f}, {ci_high:.4f}]")
```

**A confidence interval communicates the plausible range of the true effect —
strictly more informative than a bare "significant" or "not significant"
verdict.** A result reported as "+2.3%, 95% CI [-0.5%, +5.1%]" tells a
decision-maker the effect could plausibly be anywhere in that range, including
near zero or even negative — genuinely different information from a headline
"the treatment won" framing of the same underlying data. Always report the
interval, not just the pass/fail threshold.

## Common statistical mistakes in applied A/B testing

### Peeking — checking results early and stopping when "significant"

```
The problem: if you check your p-value every day and stop as soon as it
crosses 0.05, your TRUE false-positive rate is much higher than 5% — often
20-30%+ depending on how often you check — because you're effectively
running many sequential tests and taking the best (lowest) p-value you
happen to see along the way.
```

This is arguably the most damaging common mistake, because it feels
completely reasonable ("why wouldn't I check on progress?") while silently
invalidating the test's statistical guarantees. **The fix**: commit to your
pre-calculated sample size/duration and don't act on interim results, OR use
a testing method explicitly designed for repeated looks — sequential testing
(see `advanced_techniques.md`) — which controls the false-positive rate
correctly even when you check frequently.

### Multiple comparisons ("p-hacking" via metric shopping)

```
The problem: if you track 20 secondary metrics and report whichever one
happens to be significant at p < 0.05, you'd expect roughly ONE of them to
show "significance" by pure chance alone, even with a genuinely null
treatment — that's what a 5% false-positive rate means when applied 20 times.
```

**The fix**: pre-register your primary metric (see `experiment_design.md`);
treat any secondary-metric "win" as a hypothesis to test in a dedicated
follow-up experiment, not as a standalone result to act on directly.

### Simpson's Paradox — aggregate results can reverse when segmented

```
Example: Treatment wins overall, but when you segment by new vs. returning
users, treatment actually LOSES in both segments individually — because the
segments had different sizes/mix between control and treatment groups,
creating a misleading aggregate.
```

Always sanity-check a surprising aggregate result against key segments — a
result that only "wins" in the aggregate but loses (or is flat) in every
individual segment is a signal something about segment composition or
randomization balance is off, not necessarily a real effect.

### Regression to the mean

An extreme early result (very good or very bad) drawn from a noisy metric
tends to move toward the average over more data — this is a purely
statistical phenomenon, not a real trend reversing. Don't over-interpret an
early, dramatic-looking effect as durable without waiting for the
pre-calculated sample size to accumulate.

## Frequentist vs. Bayesian A/B testing

| | Frequentist | Bayesian |
|---|---|---|
| Core output | p-value, confidence interval | Posterior probability distribution over the effect |
| Typical statement | "p < 0.05, reject the null" | "There's an 87% probability treatment is better than control" |
| Requires | A pre-specified sample size/stopping rule (or sequential methods) to avoid peeking bias | A prior distribution — a genuine input choice affecting results, especially with limited data |
| Interpretability | Frequently misinterpreted (see above) | More directly answers "what's the probability my change is better," which is usually what people actually want to know |
| Early stopping | Invalid without sequential-testing correction | Naturally supports continuous monitoring in many formulations, though this still requires care |

**Neither approach is universally "correct"** — the field uses both widely.
Bayesian framing is often more intuitive to communicate to non-statistical
stakeholders ("87% probability of being better" reads more naturally than a
p-value), but requires a defensible prior and doesn't automatically solve
every peeking-related problem depending on the specific method used. Many
modern experimentation platforms (see `platforms_and_implementation.md`) offer
both, or use Bayesian methods specifically because of their more intuitive
output framing for product stakeholders.

## Practical guidance

1. **State p-value interpretation correctly, every time** — "if the null were
   true, we'd see this or more extreme data X% of the time," never "there's a
   (100-X)% chance the treatment works."
2. **Report confidence intervals alongside significance verdicts** — the
   interval carries more decision-relevant information than a binary
   pass/fail.
3. **Never check results informally and stop early based on what you see** —
   commit to the pre-calculated duration, or use sequential testing
   specifically designed for early stopping.
4. **Pre-register your primary metric** to avoid multiple-comparisons
   p-hacking via metric shopping after the fact.
5. **Sanity-check surprising aggregate wins against key segments** — a result
   that reverses under segmentation (Simpson's Paradox) needs investigation
   before you trust it.