# Troubleshooting and Common Errors

## Out-of-memory (OOM) errors

**Fix in this order** — each step trades some training speed/quality for
memory, roughly in order of "cheapest to give up first":

1. **Reduce `max_seq_length`** — the single biggest lever; activation memory
   scales with sequence length. If your data doesn't need the full length you
   configured, reduce it.
2. **Reduce `per_device_train_batch_size` to 1**, and increase
   `gradient_accumulation_steps` to compensate for the effective batch size
   (see `training.md`).
3. **Confirm `use_gradient_checkpointing="unsloth"` is set** — not the generic
   `True`, and not omitted entirely. This is specifically designed to extend
   usable context length and reduce VRAM, not just a generic memory flag — if
   you're OOMing without this set, set it before trying anything more drastic.
4. **Confirm you're using QLoRA (`load_in_4bit=True`)**, not full LoRA, if VRAM
   is genuinely tight.
5. **Reduce LoRA rank** — lower rank means fewer trainable parameters and
   somewhat lower memory overhead, though this is a smaller lever than the
   above.
6. **Reduce eval batch size / eval frequency** — `per_device_eval_batch_size`
   and `eval_accumulation_steps` in `SFTConfig` affect memory during eval
   passes specifically, separate from training memory.

## Model produces gibberish, infinite generation, or repeated output after export

**This is the most common post-training issue, and it is almost always a chat
template mismatch** between training and the inference framework you exported
to (Ollama, llama.cpp, vLLM). See `export_and_deployment.md` for the full
diagnostic checklist:
1. Confirm the exact same chat template is applied at inference as training.
2. Confirm the EOS token matches.
3. Check for a duplicate or missing BOS token.

Work through these three specifically before assuming the fine-tune itself
failed — a model that produced sensible output during in-notebook testing but
gibberish after export has, in the overwhelming majority of cases, an export
configuration problem, not a training problem.

## Loss doesn't decrease / model doesn't learn the target behavior

1. **Check the dataset formatting first** — manually print several formatted
   training examples and read them; a bug in a formatting function silently
   corrupts every example the same way, and this is a far more common root
   cause than a genuinely wrong hyperparameter.
2. **Confirm the learning rate isn't too low** — 2e-4 is the standard starting
   point for LoRA; a rate borrowed from a full-fine-tuning recipe (5e-6 to
   2e-5) is roughly 10-40x too low for LoRA and will train extremely slowly if
   at all in a reasonable number of epochs.
3. **Confirm `target_modules` actually covers the layers you need** — the
   standard 7-module set (`q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj,
   down_proj`) is the right default; a narrower set may not have enough
   capacity for your task.
4. **Check dataset size and diversity** — a handful of examples, or examples
   that don't clearly and consistently demonstrate the target behavior, won't
   reliably teach it regardless of hyperparameters.

## Loss decreases but eval quality is poor / overfitting

1. **Reduce epochs** — 1-3 is the recommended range; if you're past 3 and
   still not seeing an issue, the more likely explanation is dataset size, not
   epoch count.
2. **Add more, more-diverse training data** — the most reliable fix for
   genuine overfitting, though also the most labor-intensive.
3. **Reduce LoRA rank** — a lower-capacity adapter is inherently less prone to
   memorizing narrow training-set quirks.
4. **Check for train/eval leakage** — near-duplicate examples split across
   train and eval will make eval metrics look better than actual
   generalization performance; verify your split doesn't have this.

## Training instability (loss spikes or diverges)

1. **Lower the learning rate** — the first and most likely fix; try halving it.
2. **Increase warmup steps** — a longer warmup period smooths the initial
   training dynamics.
3. **If using a high rank (32+), try `use_rslora=True`** — standard LoRA
   scaling can become less stable at higher ranks; RSLoRA's alternative scaling
   formula is specifically designed to address this.

## MoE (Mixture-of-Experts) models behaving poorly with QLoRA

As covered in `setup_and_models.md`: **4-bit quantization can interact poorly
with MoE routing architectures.** If you're fine-tuning an MoE base model and
observing degraded behavior specifically (not present with dense models), try
full 16-bit LoRA (`load_in_16bit=True`) instead of QLoRA before troubleshooting
anything else.

## Reasoning capability degraded after fine-tuning (reasoning-capable base models)

For base models with built-in extended reasoning/"thinking" behavior, plain
instruction fine-tuning on non-reasoning examples can degrade that built-in
capability. **If preserving reasoning behavior matters, mix reasoning-style
examples into the training data** alongside direct-answer examples — a
commonly-cited practical guideline is keeping a substantial majority (roughly
75%+) of training examples in the reasoning style if maintaining that specific
capability is a requirement, rather than assuming instruction fine-tuning on
direct-answer examples alone will leave reasoning behavior untouched.

## GGUF conversion fails (`llama.cpp` not found, or architecture not recognized)

```
make: *** llama.cpp: No such file or directory.
```

This typically means the automatic GGUF export path couldn't locate or set up
its bundled `llama.cpp` dependency correctly — this can happen with newer or
unusual model architectures the bundled conversion script doesn't yet
recognize. Fallback: **clone `llama.cpp` manually and run the conversion script
directly** (see the manual conversion command in `export_and_deployment.md`),
giving you direct visibility into what's failing rather than relying entirely
on Unsloth's automated wrapper.

## A general debugging principle

**When something works during Unsloth's in-notebook testing but fails after
export or deployment, the problem is almost always in the export/deployment
configuration, not the trained weights themselves** — the model you tested
successfully in the notebook is the same model being exported; what changes is
the surrounding inference configuration (chat template, tokenizer settings,
quantization). Debug in that direction first before suspecting the training
run needs to be redone.

## Practical guidance

1. **Work through the OOM fix list in order** — sequence length and batch size
   first, since they're the cheapest, most reversible changes.
2. **Treat chat template mismatch as your default first hypothesis** for any
   post-export quality regression — it accounts for the large majority of
   "worked in Unsloth, broke in Ollama" reports.
3. **Manually inspect formatted training examples** before troubleshooting
   hyperparameters — a silent formatting bug is a more common root cause of
   "loss won't decrease" than genuinely wrong hyperparameters.
4. **Diagnose by category** (OOM, gibberish output, doesn't learn, overfits,
   unstable) and follow that category's specific fix list — resist the urge to
   randomly try hyperparameter changes without first identifying which failure
   mode you're actually looking at.