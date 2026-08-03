# Evaluation — Held-Out Eval, Qualitative Checks, Catastrophic Forgetting

## Why training loss alone is insufficient

Training loss tells you whether the model is fitting the training data — it
tells you nothing about whether that fit generalizes, whether the model has
overfit to quirks of your specific examples, or whether it has quietly lost
unrelated capabilities in the process. **Evaluation needs to check three
distinct things**, each requiring a different method:

1. Did the model learn the target task? (Held-out eval loss + task metrics)
2. Does the output actually look right to a human? (Qualitative spot-checking)
3. Did the model lose general capability while learning the new task?
   (Catastrophic forgetting checks)

## Held-out evaluation loss

```python
from trl import SFTTrainer, SFTConfig

trainer = SFTTrainer(
    model=model,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,           # from dataset.train_test_split() — see dataset_preparation.md
    args=SFTConfig(
        eval_strategy="steps",
        eval_steps=20,
        fp16_full_eval=True,               # reduce memory usage during eval passes
        per_device_eval_batch_size=2,
        eval_accumulation_steps=4,
    ),
)
```

**Watch for train loss and eval loss diverging** — train loss continuing to
drop while eval loss plateaus or rises is the classic overfitting signature.
When you see this, the fix is usually fewer epochs, more/more-diverse training
data, or a lower LoRA rank (see `lora_hyperparameters.md`) — not more training.

## Qualitative testing — read the actual outputs

```python
from unsloth import FastLanguageModel

FastLanguageModel.for_inference(model)   # enables Unsloth's faster inference mode

messages = [{"role": "user", "content": "Your test prompt here"}]
inputs = tokenizer.apply_chat_template(
    messages, tokenize=True, add_generation_prompt=True, return_tensors="pt"
).to("cuda")

outputs = model.generate(input_ids=inputs, max_new_tokens=256, use_cache=True)
print(tokenizer.batch_decode(outputs)[0])
```

**No automated metric substitutes for actually reading a sample of outputs.**
Build a small, fixed set of test prompts covering the range of your task
(easy cases, edge cases, adversarial/unusual inputs) and run them after every
training run — comparing outputs across runs is often more informative than
watching the loss curve alone, especially for subjective qualities like tone
or format adherence that a loss number doesn't directly capture.

## Task-specific metrics

For tasks with a well-defined correctness criterion, compute an actual metric
on the held-out set rather than relying on loss/qualitative checks alone:

```python
# Example: exact-match accuracy for a classification-style fine-tune
correct = 0
for example in eval_dataset:
    prediction = generate_response(model, tokenizer, example["input"])
    if prediction.strip() == example["expected_output"].strip():
        correct += 1
accuracy = correct / len(eval_dataset)
```

For generation tasks without a single "correct" answer (summarization, creative
writing, open-ended chat), consider an LLM-as-judge approach — a separate,
stronger model scoring outputs against a rubric — similar in spirit to the
`LLMJudge` pattern in this collection's `pydantic-architect` skill
(`observability_and_evals.md`), applied here to compare base-model vs.
fine-tuned-model outputs rather than agent behavior specifically.

## Catastrophic forgetting — the check most teams skip

Fine-tuning on a narrow dataset risks degrading the model's general
capabilities, even when the target task is learned well — a real, documented
failure mode, not a theoretical concern. **After fine-tuning, evaluate both
target-task performance AND general capability**, using standard benchmarks
(MMLU, HellaSwag, or similar) as a spot check, or at minimum a qualitative test
on prompts entirely unrelated to your fine-tuning task:

```python
# A lightweight qualitative forgetting check — not a rigorous benchmark,
# but catches obvious regressions cheaply
general_test_prompts = [
    "Explain how photosynthesis works.",
    "Write a haiku about autumn.",
    "What's 17 * 24?",
]
for prompt in general_test_prompts:
    response = generate_response(model, tokenizer, prompt)
    print(f"{prompt}\n→ {response}\n")
# Compare qualitatively against the BASE model's responses to the same prompts
```

If general-capability responses have visibly degraded (become incoherent,
lost basic reasoning, adopted an inappropriate tone even on unrelated topics),
this is a signal to reduce epochs, lower the learning rate, or increase
dataset diversity — the model has over-adapted to the narrow fine-tuning
distribution at the expense of its pretrained knowledge.

## A/B comparison against the base model

```python
def compare_models(prompt, base_model, finetuned_model, tokenizer):
    base_response = generate_response(base_model, tokenizer, prompt)
    finetuned_response = generate_response(finetuned_model, tokenizer, prompt)
    print(f"BASE:\n{base_response}\n\nFINETUNED:\n{finetuned_response}\n")
```

Always compare against the base model directly, not just against your own
prior fine-tuning runs — this confirms the fine-tune actually improved on the
specific behavior you targeted, rather than just producing *different* output
that happens to have lower training loss.

## Practical guidance

1. **Never rely on training loss alone** — always pair it with held-out eval
   loss, qualitative spot-checks, and (for well-defined tasks) a real task
   metric.
2. **Build a fixed qualitative test set once, and reuse it across every
   training run** — this makes runs genuinely comparable in a way a shifting
   ad-hoc set of prompts doesn't.
3. **Always run a catastrophic-forgetting check**, even a lightweight
   qualitative one — this is the evaluation step most commonly skipped, and
   the one most likely to surface a real, otherwise-invisible problem.
4. **Compare against the base model directly**, not just across your own
   fine-tuning runs, to confirm genuine improvement on the target behavior.