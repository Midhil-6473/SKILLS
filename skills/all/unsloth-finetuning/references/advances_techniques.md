# Beyond SFT — Preference Tuning, Vision/Multimodal Fine-Tuning

## When you need more than supervised fine-tuning (SFT)

Everything covered elsewhere in this skill is **SFT** (Supervised Fine-Tuning)
— teaching the model to produce specific target outputs for given inputs. This
covers the large majority of practical fine-tuning needs: format, tone,
domain-specific task behavior. A smaller set of needs call for different
techniques.

## Preference tuning — DPO, ORPO, and friends

**When to reach for these**: shaping *subtle* behavioral preferences from
*comparisons* between outputs (this response is better than that one) rather
than from single correct-answer examples. **You almost never need these for
straightforward tone, format, or classification tasks** — those are exactly
what SFT handles well and more simply. Preference tuning is a later, more
advanced step, not a starting point — if you're new to fine-tuning, ignore this
section until SFT has been tried and specifically found insufficient for a
genuinely comparison-shaped problem (e.g., "make responses more helpful and
less verbose" is a preference/comparison problem; "always output valid JSON in
this schema" is a plain SFT problem).

```python
from trl import DPOTrainer, DPOConfig

# DPO training data is pairs of (chosen, rejected) responses to the same prompt,
# not single input->output examples
dpo_dataset_example = {
    "prompt": "Explain quantum computing.",
    "chosen": "Quantum computing uses quantum bits (qubits) that can exist in superposition...",
    "rejected": "Quantum computing is when computers use quantum stuff to be fast and cool.",
}

dpo_trainer = DPOTrainer(
    model=model,
    args=DPOConfig(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=1,
        learning_rate=5e-6,          # DPO typically uses a LOWER learning rate than SFT
        beta=0.1,                       # controls how strongly to diverge from the reference model
    ),
    train_dataset=dpo_dataset,
    tokenizer=tokenizer,
)
dpo_trainer.train()
```

**A common, sensible workflow**: SFT first to teach the base task/format, then
DPO on top of the SFT-trained model to refine subtler quality/preference
dimensions — not DPO as a replacement for SFT, but as an optional additional
stage after SFT has established the core behavior.

## Vision and multimodal fine-tuning

For vision-language models, the core workflow (load → attach LoRA → train with
`SFTTrainer` → export) is structurally the same, with dataset format and a few
settings adjusted for image inputs:

```python
from unsloth import FastVisionModel

model, tokenizer = FastVisionModel.from_pretrained(
    model_name="unsloth/Llama-3.2-11B-Vision-Instruct",
    load_in_4bit=True,
)

model = FastVisionModel.get_peft_model(
    model,
    finetune_vision_layers=True,       # whether to adapt the vision encoder itself
    finetune_language_layers=True,      # whether to adapt the language model layers
    finetune_attention_modules=True,
    finetune_mlp_modules=True,
    r=16,
    lora_alpha=16,
)
```

```python
# Vision dataset format — includes image content alongside text
{
    "messages": [
        {"role": "user", "content": [
            {"type": "image", "image": "<PIL Image or path>"},
            {"type": "text", "text": "What's in this image?"},
        ]},
        {"role": "assistant", "content": [{"type": "text", "text": "A golden retriever sitting in a park."}]},
    ]
}
```

**Whether to fine-tune vision layers vs. only language layers depends on the
task**: if the task is purely about how the model *describes/reasons about*
images it can already see well (e.g., adopting a specific description format
or tone), fine-tuning only the language layers is often sufficient and cheaper;
if the task requires the model to perceive visual details it currently
struggles with (a specialized domain like medical imaging or technical
diagrams), fine-tuning the vision encoder layers too becomes more important.

### Audio fine-tuning

For audio-capable models, a similar pattern applies with audio-specific
guidance worth following directly from the model family's own fine-tuning
examples (audio fine-tuning conventions vary more by model architecture than
text/vision does) — keep audio clips short and task-specific rather than
attempting long-form audio in early experiments, since long audio sequences
consume disproportionate context/memory relative to their information content
for most fine-tuning tasks.

## Continued pretraining (domain adaptation via raw text)

```python
# Plain text format, no instruction/response structure — see dataset_preparation.md
dataset = load_dataset("your_domain_corpus", split="train")   # {"text": "..."} format

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    dataset_text_field="text",
    args=SFTConfig(learning_rate=1e-4, num_train_epochs=1, ...),   # often a lower LR than instruction SFT
)
```

Use this specifically to teach a model unfamiliar vocabulary or writing style
through raw exposure (e.g., a specialized scientific domain's terminology and
prose style) — **before** instruction-tuning it on your actual target task, if
the domain is genuinely unfamiliar to the base model. This is a less
sample-efficient, less commonly needed technique than instruction SFT for most
practical applications; reach for it specifically when instruction SFT alone
isn't teaching the domain effectively, not as a default first step.

## Reinforcement learning approaches (GRPO and beyond)

For tasks with a well-defined, programmatically-checkable reward signal (e.g.,
correctness of a math solution, passing a code test suite), reinforcement
learning approaches like GRPO (Group Relative Policy Optimization) are an
increasingly common technique in the field, supported by Unsloth for relevant
model families. This is a genuinely advanced technique — appropriate once SFT
(and possibly DPO) have been tried and a specific, programmatically-verifiable
reward signal is available to optimize against; not a starting point for most
fine-tuning projects, and worth pursuing specifically once you have a clear
sense of why supervised approaches aren't sufficient for your particular task.

## Practical guidance

1. **Start with plain SFT for nearly everything** — format, tone, domain
   task behavior are all SFT problems; don't reach for DPO/preference tuning
   or RL approaches as a first step.
2. **Use DPO as a refinement stage after SFT**, specifically for subtle
   comparison-shaped quality dimensions SFT alone doesn't capture well.
3. **For vision fine-tuning, decide whether the task needs the vision encoder
   itself adapted**, or only the language layers — this materially affects
   cost and what the fine-tune can actually achieve.
4. **Reach for continued pretraining only when the domain is genuinely
   unfamiliar to the base model** — not as a default preprocessing step before
   every instruction fine-tune.
5. **Treat GRPO/RL approaches as advanced, later-stage techniques** requiring a
   specific programmatically-verifiable reward signal — not a starting point.