# Training — SFTTrainer, SFTConfig, Monitoring

## The full training setup

```python
from trl import SFTTrainer, SFTConfig

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,           # always include this — see dataset_preparation.md
    dataset_text_field="text",
    max_seq_length=2048,
    dataset_num_proc=2,
    packing=False,                          # see "packing" section below
    args=SFTConfig(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=5,
        num_train_epochs=1,
        learning_rate=2e-4,
        fp16=not is_bfloat16_supported(),
        bf16=is_bfloat16_supported(),
        logging_steps=1,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=3407,
        output_dir="outputs",
        eval_strategy="steps",
        eval_steps=20,
        fp16_full_eval=True,                # reduce memory during eval
        per_device_eval_batch_size=2,
        eval_accumulation_steps=4,
    ),
)

trainer_stats = trainer.train()
```

`SFTTrainer` comes from Hugging Face's `trl` library unchanged — Unsloth
accelerates the model loading and adapter layers underneath, not the trainer
API itself, so if you've used `trl` before, this will look immediately
familiar.

## `fp16` vs `bf16` — let Unsloth pick

```python
from unsloth import is_bfloat16_supported

fp16=not is_bfloat16_supported(),
bf16=is_bfloat16_supported(),
```

Use `is_bfloat16_supported()` to select automatically rather than hardcoding
one — bf16 is preferred on Ampere-and-newer GPUs (RTX 30-series+, A100, etc.)
for better numerical stability; fp16 is the fallback for older GPUs (like the
free-tier Colab T4) that don't support bf16.

## Optimizer choice

```python
optim="adamw_8bit",   # the standard Unsloth-recommended choice
```

An 8-bit AdamW optimizer significantly reduces optimizer-state memory overhead
compared to standard 32-bit AdamW, with negligible impact on training quality
for LoRA fine-tuning specifically — a meaningful contributor to Unsloth's
overall memory savings, and the right default rather than standard `adamw_torch`.

## Warmup and learning rate schedule

```python
warmup_steps=5,                     # or warmup_ratio=0.03 for a percentage-based warmup
lr_scheduler_type="linear",          # or "cosine" for a smoother decay
```

A short warmup period (gradually ramping the learning rate up from near-zero)
stabilizes the first few training steps, especially important given LoRA's
relatively high learning rate (see `lora_hyperparameters.md`). Linear decay is
the simple, standard default; cosine decay is a common alternative worth trying
if you observe training-quality issues near the end of a run.

## `packing` — trading a small quality risk for speed

```python
packing=False,   # the safer default
# packing=True,  # can make training up to 5x faster for SHORT sequences specifically
```

Packing concatenates multiple short training examples into a single sequence to
better utilize the full `max_seq_length`, avoiding wasted compute on padding.
**It can meaningfully speed up training for datasets with many short
examples** — but introduces a subtlety where the model may see attention across
example boundaries unless the packing implementation handles this correctly.
Start with `packing=False` for correctness; revisit `packing=True` specifically
if training speed on a large dataset of short examples is a genuine bottleneck.

## Monitoring training — what to actually watch

```python
trainer_stats = trainer.train()
# Loss should generally trend downward; watch for:
# - Loss plateauing immediately (learning rate too low, or rank too small)
# - Loss spiking/diverging (learning rate too high)
# - Train loss dropping while eval loss rises (overfitting — see evaluation.md)
```

With `logging_steps=1` and `eval_strategy="steps"` + `eval_steps=20` (or similar),
you get frequent enough signal to catch these patterns early rather than only
discovering a problem after a full training run completes. For longer runs,
consider connecting to a proper experiment tracker (Weights & Biases, or
similar) rather than relying solely on console log output — trl's `SFTConfig`
supports standard Hugging Face `Trainer` reporting integrations.

## Resuming from a checkpoint

```python
args = SFTConfig(
    output_dir="outputs",
    save_strategy="steps",
    save_steps=50,
    save_total_limit=3,   # keep only the last 3 checkpoints, to manage disk space
    ...
)

# To resume:
trainer.train(resume_from_checkpoint=True)
```

Checkpointing matters especially on free/preemptible compute (Colab sessions
can disconnect) — set a reasonable `save_steps` interval so a lost session
doesn't mean starting training over from scratch.

## Practical guidance

1. **Always include `eval_dataset` and set an `eval_strategy`** — training loss
   alone is an incomplete picture (see `evaluation.md` for what to do with it).
2. **Use `is_bfloat16_supported()` rather than hardcoding precision** — let it
   pick the right setting for the actual GPU in use.
3. **Use `adamw_8bit`** as the default optimizer for LoRA fine-tuning — a real,
   nearly-free memory saving.
4. **Start with `packing=False`** for correctness; revisit only if training
   speed on many short examples is a genuine bottleneck.
5. **Set `save_steps` and `save_total_limit` deliberately** on any run of
   meaningful length, especially on preemptible/free compute.