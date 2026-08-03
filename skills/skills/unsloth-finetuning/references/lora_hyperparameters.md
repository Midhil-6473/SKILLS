# LoRA/QLoRA Hyperparameters in Depth

## The `get_peft_model` call — every parameter explained

```python
model = FastLanguageModel.get_peft_model(
    model,
    r=16,                                             # rank
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                     "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,                                      # scaling factor
    lora_dropout=0,                                      # regularization
    bias="none",                                          # which biases to train
    use_gradient_checkpointing="unsloth",                   # memory optimization
    random_state=3407,
    use_rslora=False,                                        # rank-stabilized LoRA variant
    loftq_config=None,                                         # LoftQ quantization-aware init
)
```

## Rank (`r`) — the most impactful single knob

Controls the number of trainable parameters in the LoRA adapter matrices — a
higher rank increases the adapter's capacity (how much it can learn/change) but
also increases memory usage and overfitting risk on small datasets.

| Rank | When to use |
|---|---|
| 8 | Very narrow, simple tasks (a single consistent format change); minimal VRAM |
| **16** | **The recommended default** — a solid starting point for most tasks |
| 32-64 | More complex domain shifts, when 16 demonstrably underperforms; more VRAM, more overfitting risk on small datasets |
| 128+ | Rarely necessary; approaching full fine-tuning's parameter count without the benefit |

**Start at 16 and only increase if you observe the model underfitting** (loss
plateaus too high, model fails to learn the target behavior even after
reasonable training) — don't default to a higher rank preemptively; higher rank
without a demonstrated need mainly adds VRAM cost and overfitting risk.

## Alpha (`lora_alpha`) — scaling the adapter's influence

Scales the strength of the fine-tuned adjustments relative to the rank.
**Standard heuristic: set `lora_alpha` equal to `r`, or `r * 2`.** The
alpha-to-rank ratio effectively controls how strongly the adapter's learned
changes are weighted relative to the frozen base model — a common, simple
starting point is `alpha = rank` (e.g., `r=16, lora_alpha=16`), with `alpha = 2
* rank` as the next thing to try if the effect feels too weak.

## Dropout (`lora_dropout`)

A regularization technique randomly zeroing a fraction of LoRA activations
during training to reduce overfitting. **Unsloth's default recommendation is 0**
— in practice, for the relatively small number of trainable parameters LoRA
already introduces, dropout adds little benefit and is not considered
particularly useful; leave it at 0 unless you have a specific overfitting
problem dropout is meant to address.

## `target_modules` — which layers get adapters

```python
target_modules=["q_proj", "k_proj", "v_proj", "o_proj",   # attention projections
                 "gate_proj", "up_proj", "down_proj"]        # MLP/feedforward projections
```

This standard set covers both the attention mechanism and the feedforward
network — the combination most fine-tuning guides and Unsloth's own defaults
recommend for general-purpose instruction fine-tuning. Targeting only attention
projections (`q_proj`, `k_proj`, `v_proj`, `o_proj`) is a lighter-weight
alternative when VRAM is extremely constrained, at some cost to adaptation
capacity — the full 7-module set is the right starting default for most tasks.

## Learning rate

| Range | Guidance |
|---|---|
| 2e-4 | **The recommended starting point** for standard LoRA/QLoRA fine-tuning |
| 1e-4 to 5e-4 | The practical tuning range around the default |
| 5e-6 to 2e-5 | Full fine-tuning range (much lower) — **do not use full-fine-tuning learning rates for LoRA** |

**LoRA's learning rate needs to be meaningfully higher than full fine-tuning's**
— roughly 5-10x higher — precisely because LoRA has far fewer trainable
parameters, so each parameter needs to move further to achieve a comparable
effect. This is a common mistake when adapting a full-fine-tuning recipe to
LoRA without adjusting the learning rate down... in the wrong direction (people
sometimes assume LoRA needs a *lower* rate since it's "gentler," which is
backwards). **Setting it too high (beyond roughly 5e-4) risks training
instability** — if loss spikes or diverges, that's the first parameter to check.

## Epochs

**Recommended: 1-3 epochs.** Beyond 3 epochs, returns diminish and overfitting
risk rises substantially — LoRA fine-tuning on a focused dataset converges much
faster than full pretraining, and over-training is a more common failure mode
than under-training once you're past the recommended range. If 1-3 epochs isn't
producing the desired behavior, the more likely fix is dataset quality/size or
rank, not simply more epochs.

## Batch size and gradient accumulation

```python
args = SFTConfig(
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,   # effective batch size = 2 * 4 = 8
    ...
)
```

**Effective batch size = `per_device_train_batch_size` × `gradient_accumulation_steps`.**
A commonly cited stable target for the effective batch size is around 16 (e.g.,
`per_device_train_batch_size=2` with `gradient_accumulation_steps=8`, or
similar combinations multiplying to roughly that range). Gradient accumulation
lets you simulate a larger effective batch size than would otherwise fit in
VRAM, by accumulating gradients across several smaller forward/backward passes
before updating weights — the standard technique for training with a
meaningfully-sized effective batch on limited hardware.

## `use_gradient_checkpointing="unsloth"` — not just `True`

```python
use_gradient_checkpointing="unsloth",   # correct — Unsloth's optimized implementation
# use_gradient_checkpointing=True,       # works, but is the generic HF implementation
```

Gradient checkpointing trades compute for memory (recomputing activations during
the backward pass instead of storing them all) — standard practice for fitting
larger models/longer sequences in limited VRAM. **Unsloth's `"unsloth"` string
value is specifically optimized to extend usable context length and reduce VRAM
further** than the plain boolean `True` (which uses the generic Hugging Face
implementation) — always prefer the string value when using Unsloth.

## Rank-Stabilized LoRA (`use_rslora`) and LoftQ (`loftq_config`)

```python
use_rslora=True,    # scales alpha by 1/sqrt(r) instead of 1/r — more stable at high ranks
loftq_config=LoftQConfig(loftq_bits=4),   # quantization-aware adapter initialization
```

**RSLoRA** is worth trying specifically if you're using a higher rank (32+) and
observing training instability — it changes the alpha scaling formula to remain
stable at higher ranks, where standard LoRA scaling can become less effective.
**LoftQ** initializes the LoRA adapters in a way that's aware of the base
model's quantization, which can improve QLoRA's starting point — a more advanced
option worth exploring once you've validated the basic pipeline works and are
optimizing further, not a default starting choice.

## DoRA — Weight-Decomposed LoRA

DoRA decomposes pretrained weights into magnitude and direction components,
training the direction with LoRA-style low-rank adaptation while handling
magnitude separately. Reported to outperform standard LoRA at the same rank
across multiple benchmark tasks, with no additional inference overhead once
merged. **Unsloth supports DoRA** — worth experimenting with specifically for
quality-sensitive tasks once you have a working standard-LoRA baseline to
compare against; the default for most fine-tuning in 2026 remains plain
QLoRA/LoRA, with DoRA as a documented, worthwhile variant to try rather than an
automatic upgrade.

## A practical hyperparameter-tuning workflow

1. **Start entirely at Unsloth's defaults** (r=16, alpha=16, dropout=0, lr=2e-4,
   1-3 epochs, gradient_checkpointing="unsloth").
2. **Train and evaluate** (see `evaluation.md`).
3. **If underfitting** (target behavior not learned): try more epochs (up to 3),
   then higher rank, then check dataset quality/size before anything else.
4. **If overfitting** (eval loss diverges from train loss, or qualitative
   quality degrades on held-out examples despite low training loss): fewer
   epochs, more/more-diverse data, or a lower rank.
5. **If training is unstable** (loss spikes/diverges): lower the learning rate
   first; consider RSLoRA if using a high rank.
6. **Only then** explore DoRA, LoftQ, or more exotic variants — after the basic
   recipe is validated as working.

## Practical guidance

1. **Trust Unsloth's defaults as your starting point** — they're derived from
   extensive experimentation, and deviating without a specific observed reason
   usually costs more than it helps.
2. **Remember LoRA needs a HIGHER learning rate than full fine-tuning**, not
   lower — a common, backwards intuition to watch for.
3. **1-3 epochs, not more** — over-training is more common than under-training
   once you're in the recommended range.
4. **Always use `use_gradient_checkpointing="unsloth"`**, the string, not the
   boolean.
5. **Diagnose problems by category** (underfitting vs. overfitting vs.
   instability) before reaching for a specific hyperparameter change — see the
   tuning workflow above.