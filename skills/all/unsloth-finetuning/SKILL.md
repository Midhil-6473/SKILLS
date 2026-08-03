---
name: unsloth-finetuning
description: >
  Complete manual for fine-tuning LLMs with Unsloth — a library that makes
  LoRA/QLoRA fine-tuning 2x faster with up to 70% less VRAM via hand-written GPU
  kernels. Use whenever the user asks about fine-tuning an LLM, Unsloth, LoRA,
  QLoRA, PEFT, training a custom model on their own data, when to fine-tune vs.
  use RAG, dataset preparation for fine-tuning (chat templates, instruction
  format), hyperparameters (rank, alpha, learning rate, epochs), SFTTrainer,
  exporting to GGUF/Ollama/vLLM, or running fine-tuning on limited VRAM/a free
  Colab GPU. Also trigger for beginner questions like what fine-tuning is, why
  it needs so much less memory than it used to, or whether a task actually needs
  fine-tuning at all versus prompting or RAG.
---

# The Unsloth Fine-Tuning Manual

You are acting as an expert ML engineer specializing in efficient LLM
fine-tuning. Unsloth is an open-source library that makes LoRA/QLoRA fine-tuning
**2-5x faster with up to 70% less VRAM**, by hand-deriving the backpropagation
math for transformer layers and rewriting it as custom Triton GPU kernels instead
of relying on PyTorch's generic autograd — while remaining fully compatible with
the Hugging Face ecosystem (`transformers`, `peft`, `trl`, `datasets`).

**Docs home:** `unsloth.ai/docs` · **GitHub:** `github.com/unslothai/unsloth`

## The first question: does this task actually need fine-tuning?

Fine-tuning is one of three ways to customize an LLM's behavior — and it's often
the wrong first choice. Check this before doing anything else:

| Need | Right tool |
|---|---|
| The model needs access to specific facts/documents that change over time | **RAG** (see this collection's `llamaindex-architect`/`langchain-architect` skills) — not fine-tuning |
| The model needs a consistent tone, format, or domain-specific style/behavior | **Fine-tuning** — this is the right tool |
| The model needs to follow a rigid output structure reliably | Often **structured output** (see `pydantic-architect`) is enough; fine-tuning helps when prompting alone isn't reliable enough |
| The model needs occasional guidance on a narrow decision | **Prompting** — cheapest, fastest, try this first always |
| The model needs to reason better about a domain it's weak in | Fine-tuning **can** help, but often less than expected — consider RAG + better prompting first |

**The most common mistake**: reaching for fine-tuning to inject *knowledge* (facts,
current data) — that's what RAG is for. Fine-tuning teaches a model *how to
behave* (tone, format, task-specific patterns), not *what to know*. Fine-tuning
and RAG are complementary, not competing — many production systems use both: a
fine-tuned model for consistent behavior/format, RAG for up-to-date facts.

## LoRA vs. QLoRA — the core decision

| | LoRA | QLoRA |
|---|---|---|
| Precision | 16-bit | 4-bit base + 16-bit adapters |
| VRAM | ~4x more than QLoRA | ~4x less than LoRA |
| Speed | Slightly faster | Slightly slower |
| Accuracy | Slightly higher | Marginally lower (usually negligible) |
| Fits on | Higher-VRAM GPUs (24GB+) | A free Colab T4 (16GB) for 7-8B models; a single 24GB GPU for 33B+ |

**Default to QLoRA** — the accuracy gap is small, and it's what makes fine-tuning
accessible on consumer/free hardware at all (a 7-8B model fits in under 10GB VRAM
with QLoRA). Reach for full LoRA specifically when you have ample VRAM and are
chasing the last bit of accuracy.

## Quick-start: fine-tune a model in ~20 lines

```python
from unsloth import FastLanguageModel
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Meta-Llama-3.1-8B-Instruct",
    max_seq_length=2048,
    load_in_4bit=True,   # QLoRA
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,                 # LoRA rank
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                     "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,
    use_gradient_checkpointing="unsloth",   # Unsloth's own optimized mode
    random_state=3407,
)

dataset = load_dataset("your_dataset", split="train")

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=2048,
    args=SFTConfig(per_device_train_batch_size=2, gradient_accumulation_steps=4,
                   num_train_epochs=1, learning_rate=2e-4, output_dir="outputs"),
)
trainer.train()

model.save_pretrained_gguf("finetuned_model", tokenizer, quantization_method="q4_k_m")
```

This is the whole pipeline in outline: load (4-bit) → attach LoRA adapters →
prepare dataset → train with `SFTTrainer` → export to GGUF for local inference.
Every reference file below expands one stage of this pipeline in depth.

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Setup: installing Unsloth, choosing a base model, VRAM planning | `references/setup_and_models.md` |
| Dataset preparation: chat templates, instruction format, formatting functions, train/eval split | `references/dataset_preparation.md` |
| LoRA/QLoRA hyperparameters in depth: rank, alpha, dropout, target modules, DoRA | `references/lora_hyperparameters.md` |
| Training: SFTTrainer/SFTConfig, learning rate, epochs, batch size, gradient checkpointing, monitoring loss | `references/training.md` |
| Evaluation: held-out eval, qualitative checks, catastrophic forgetting, benchmarks | `references/evaluation.md` |
| Exporting and deploying: adapter-only save, merging, GGUF quantization levels, Ollama/vLLM/llama.cpp | `references/export_and_deployment.md` |
| Common errors and troubleshooting: chat template mismatches, quantize+merge order, OOM fixes | `references/troubleshooting.md` |
| Beyond SFT: DPO/preference tuning, vision/multimodal fine-tuning, when to reach for these | `references/advanced_techniques.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Confirm fine-tuning is the right tool before starting** — see the
   decision table above; this is the single most common wasted-effort mistake.
2. **Default to QLoRA (`load_in_4bit=True`)** unless you have a specific reason
   (ample VRAM, maximum accuracy requirement) to use full 16-bit LoRA.
3. **Use `use_gradient_checkpointing="unsloth"`**, not `True` — Unsloth's own
   mode is specifically optimized to extend context length and reduce VRAM
   further than the generic Hugging Face implementation.
4. **Always hold out an eval set** (`dataset.train_test_split`) — training loss
   alone doesn't tell you if the model generalizes or has overfit.
5. **Use the exact same chat template at inference time that you trained
   with** — a mismatched chat template is the single most common cause of a
   fine-tuned model producing gibberish, infinite generation, or repeated output
   after export to Ollama/llama.cpp/vLLM.
6. **Start with Unsloth's recommended defaults** (rank 16, alpha = rank,
   learning rate 2e-4, 1-3 epochs) rather than tuning blindly — they're derived
   from hundreds of experiments; deviate only once you have a specific,
   observed reason to.
7. **Evaluate for catastrophic forgetting, not just target-task performance** —
   after fine-tuning, check the model hasn't lost general capability (a quick
   MMLU/HellaSwag-style spot check, or just qualitative testing on unrelated
   prompts), not only whether it learned the new task.
8. **Source of truth: `unsloth.ai/docs`.** This library and the surrounding
   ecosystem (new base models, new quantization methods, DoRA and other PEFT
   variants) move fast — web-search for anything version-specific or for
   support of a very recent model family rather than assuming training-data
   knowledge is current.