# Setup — Installing Unsloth, Choosing a Base Model, VRAM Planning

## Installation

```bash
pip install unsloth
```

```bash
# For the latest features/fixes, install directly from GitHub
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
```

**The 2026 fine-tuning stack** centers on Python 3.11+, PyTorch 2.5+, CUDA 12.x,
and the Hugging Face ecosystem (`transformers`, `datasets`, `peft`, `trl`) —
Unsloth is a drop-in acceleration layer on top of this stack, not a replacement
for it. If you already know the Hugging Face fine-tuning workflow, Unsloth's API
will look immediately familiar (`SFTTrainer` from `trl` is unchanged; Unsloth
replaces the model-loading and adapter-attachment steps with faster equivalents).

## Where to run it

| Environment | Notes |
|---|---|
| **Google Colab (free tier, T4 GPU)** | The standard starting point — a free 16GB T4 fits 7-8B models via QLoRA. Unsloth ships ready-to-run Colab notebooks per model family. |
| **Local GPU** | Any NVIDIA GPU with CUDA support; VRAM determines model size ceiling (see table below). |
| **Cloud GPU rental** (RunPod, Lambda, etc.) | For larger models or faster iteration once a local/free setup proves the approach works. |
| **Unsloth Studio** | A local UI (built on `uv` for environment management) wrapping the same underlying training pipeline — useful if you prefer a GUI over notebook/script-based training. |

**Practical workflow**: prove out your approach on a small model + free Colab T4
first (fast iteration, zero cost), then scale up model size / move to rented
GPU hardware only once the dataset and hyperparameters are validated — don't
start by renting an expensive GPU for a fine-tuning approach you haven't
validated yet.

## Choosing a base model

```python
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Meta-Llama-3.1-8B-Instruct",   # note the "unsloth/" prefix
    max_seq_length=2048,
    load_in_4bit=True,
)
```

**Prefer `unsloth/`-prefixed model repos on Hugging Face** where available —
Unsloth maintains pre-quantized, pre-optimized versions of popular base models
specifically tuned for their loading/training pipeline, rather than pointing at
the original publisher's repo and quantizing on the fly.

### Model family support (broad strokes, verify current specifics)

QLoRA and Unsloth's kernels work out of the box with the major open model
families: Llama 3.x, Mistral, Qwen 2.5+, Phi-3/4, Gemma 2+, and other
mainstream architectures — Unsloth's team works directly with the teams behind
several of these (gpt-oss, Qwen, Llama, Mistral, Gemma, Phi), fixing bugs that
measurably affect fine-tuned accuracy. **Always start from an Instruct/Chat
variant, not a base/pretrained-only variant**, unless you specifically intend
to teach the model conversational behavior from scratch — Instruct variants
already have the chat-following behavior your fine-tune will build on top of.

### Choosing model size for your task

| Model size | Typical use case | Minimum practical VRAM (QLoRA) |
|---|---|---|
| 1-3B | Simple classification, narrow format tasks, edge/mobile deployment targets | ~6-8GB |
| 7-8B | The default choice — strong capability/cost balance for most fine-tuning tasks | ~8-10GB (free Colab T4 territory) |
| 13-14B | More complex reasoning/domain tasks, when 7-8B underperforms | ~12-16GB |
| 30-34B | Demanding tasks, when smaller models plateau | ~20-24GB |
| 70B+ | Frontier-adjacent capability, complex multi-step domain tasks | ~24-48GB (QLoRA specifically is what makes this feasible at all — the original QLoRA paper's headline result was 65B fine-tuning on a single 48GB GPU) |

**Don't default to the largest model you can technically fit** — a well-tuned
7-8B model on a clean, focused dataset frequently outperforms a poorly-tuned
larger model, and iterates far faster. Start small, validate the approach,
scale up only if the smaller model demonstrably plateaus on your actual task.

## VRAM budget — what actually consumes memory

```
Total VRAM ≈ Base model (4-bit) + LoRA adapters (16-bit) + Optimizer state +
             Activations (scales with sequence length × batch size) + Overhead
```

Concretely: an 8B model fine-tunes in **under 10GB VRAM** with QLoRA at sequence
length ≤512, batch size 1, and gradient checkpointing enabled. VRAM usage
increases roughly proportionally with longer sequences or larger batch sizes —
if you hit an out-of-memory error, sequence length and batch size are the first
two knobs to reduce (see `troubleshooting.md`).

## A note on MoE (Mixture-of-Experts) architectures

For Mixture-of-Experts base models specifically, **QLoRA's 4-bit quantization
can interact poorly with the MoE routing architecture** — for MoE models, prefer
full 16-bit LoRA (`load_in_16bit=True`) over 4-bit QLoRA if you observe degraded
behavior, rather than assuming QLoRA is always the safe default across every
architecture.

## Practical guidance

1. **Start on a free Colab T4 with a 7-8B model** — validate your dataset and
   approach before spending money on bigger hardware.
2. **Use `unsloth/`-prefixed model repos** where available, for
   pre-optimized loading.
3. **Start from an Instruct/Chat variant**, not a raw base model, for nearly
   all practical fine-tuning tasks.
4. **Don't default to the largest model that fits** — validate that a smaller
   model actually plateaus on your task before scaling up.
5. **Watch for the MoE + QLoRA interaction issue** specifically — full LoRA is
   the safer default for MoE architectures.