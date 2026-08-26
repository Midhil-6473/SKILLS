# Advanced Techniques — CUPED, Sequential Testing, Multi-Armed Bandits

## CUPED — reducing variance using pre-experiment data

**The problem CUPED solves**: high-variance metrics require large sample
sizes to reach statistical significance — some of that variance comes from
stable, pre-existing differences between users (a naturally heavy purchaser
vs. a naturally light one) that have nothing to do with the treatment.
**CUPED (Controlled-experiment Using Pre-Existing Data)**, introduced by
Microsoft Research in 2013, uses each user's *pre-experiment* behavior on the
same metric as a covariate to strip out that predictable, treatment-unrelated
variance — tightening confidence intervals and letting you reach significance
with a smaller sample, without changing what you're actually measuring.

```python
import numpy as np

def cuped_adjust(y, x, x_mean=None):
    """
    y: the metric during the experiment (e.g., purchases during the test period)
    x: the SAME metric measured for the SAME users BEFORE the experiment started
    """
    if x_mean is None:
        x_mean = np.mean(x)
    theta = np.cov(y, x)[0, 1] / np.var(x)   # the optimal adjustment coefficient
    y_adjusted = y - theta * (x - x_mean)
    return y_adjusted

# Compare variance before and after CUPED adjustment
y_treatment_adjusted = cuped_adjust(treatment_metric, treatment_pre_period_metric)
print(f"Variance before CUPED: {np.var(treatment_metric):.4f}")
print(f"Variance after CUPED:  {np.var(y_treatment_adjusted):.4f}")
```

**CUPED works best on metrics with a strong, stable pre-experiment covariate**
— purchase behavior, engagement level, and similar metrics that are
predictable from a user's own history are excellent candidates; metrics with
no meaningful pre-experiment analog (a brand-new feature nobody could have
used before) get little to no benefit. In practice, CUPED can meaningfully
reduce required sample size for well-suited metrics — a real, low-cost
technique (it's a post-hoc statistical adjustment, not a change to how the
experiment runs) worth adopting once your team runs experiments regularly on
metrics with clean pre-period history.

## Sequential testing — valid early stopping

**The problem sequential testing solves**: fixed-horizon tests (calculate a
sample size, wait until you hit it) can't be checked early without inflating
false positives (the "peeking" problem — see `statistical_analysis.md`).
**Sequential testing methods** (e.g., mSPRT — mixture Sequential Probability
Ratio Test, or the AGILE method) are specifically designed to control the
false-positive rate correctly **even when you check results repeatedly** —
letting you stop early when a clear effect emerges, or stop early for
"futility" when it's increasingly clear no meaningful effect exists, without
invalidating your statistical guarantees.

```
The real trade-off: sequential tests sometimes run SHORTER than an
equivalent fixed-horizon test (when the true effect is larger than your MDE
estimate) — but can also run 2-3x LONGER in the worst case (when your MDE
estimate is accurate and there's no early clear signal), since the method is
inherently more conservative to maintain valid error control across
repeated looks. The benefit is genuine robustness to a misestimated MDE,
which in practice is common — teams frequently misjudge the expected effect
size by 30-50%, and sequential methods handle that misjudgment far more
gracefully than a fixed-horizon design.
```

**Use sequential testing when**: you have a genuine business need to end
tests as early as safely possible (fast-moving teams, expensive traffic), or
when you're uncertain about your MDE estimate going in. **Stick with
fixed-horizon testing when**: your team already has disciplined
pre-registration practices and doesn't feel pressure to peek — the simpler
method, correctly followed, works fine. Most modern experimentation platforms
(see `platforms_and_implementation.md`) implement sequential testing natively
specifically so teams get the "safe to check anytime" property without
needing to implement the underlying statistics themselves.

## Multi-armed bandits — when to reach for them instead

**A/B testing** allocates traffic evenly (or in a fixed ratio) throughout the
test and only shifts everyone to the winner *after* the test concludes.
**Multi-armed bandits** continuously and automatically shift traffic toward
whichever variant is currently performing best, *during* the test itself —
trading statistical rigor (a clean, interpretable causal estimate) for
reduced "regret" (less traffic wasted on an underperforming variant while the
test runs).

| | A/B Testing | Multi-Armed Bandit |
|---|---|---|
| Traffic allocation | Fixed throughout the test | Dynamically shifts toward the current leader |
| Best for | Learning a clean, generalizable causal answer ("does this feature help?") | Short-lived decisions where minimizing opportunity cost matters more than a precise effect estimate (headline/content selection, short promotional campaigns) |
| Statistical rigor | High — designed for valid causal inference | Lower — optimized for cumulative outcome during the test, not for producing a clean, reusable causal estimate afterward |
| Interpretability | Clear effect size + confidence interval | Harder to extract a clean "how much better was it" answer |

**Choose based on your actual goal**: if you need to know "does this feature
genuinely improve outcomes, and by how much, so we can make a durable product
decision" — use A/B testing. If you need "get the best cumulative outcome
from this specific, time-boxed decision, and I don't need a clean causal
estimate afterward" (e.g., picking the best-performing headline for a
one-week campaign) — a bandit is often the better fit.

## Practical guidance

1. **Use CUPED whenever your metric has a strong, stable pre-experiment
   covariate** — it's close to a free variance reduction, meaningfully
   shortening required test duration for well-suited metrics.
2. **Reach for sequential testing specifically to solve the peeking problem
   safely**, not as a default replacement for fixed-horizon testing — both are
   valid when used correctly for their intended purpose.
3. **Understand that sequential testing trades average-case efficiency for
   robustness to MDE misestimation** — it can run longer in the worst case, but
   handles the common real-world case of a wrong MDE guess much better.
4. **Choose bandits over A/B tests specifically when the goal is minimizing
   regret on a time-boxed decision**, not when you need a clean, reusable
   causal estimate for a durable product decision.