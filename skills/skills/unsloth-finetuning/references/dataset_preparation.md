# Dataset Preparation — Chat Templates, Formatting, Train/Eval Split

## Why dataset quality matters more than any hyperparameter

Fine-tuning is fundamentally a "teach by example" process — the model learns
whatever pattern is actually present in your dataset, including any noise,
inconsistency, or errors. **A clean, well-formatted, focused dataset of a few
hundred to a few thousand high-quality examples routinely outperforms a much
larger noisy one.** Time spent cleaning and formatting data is almost always
better spent than time spent tuning hyperparameters.

## Common dataset formats

```python
# Instruction format — a single instruction/input/output triple per example
{
    "instruction": "Summarize the following customer complaint in one sentence.",
    "input": "I've called three times about my broken order and nobody has helped me...",
    "output": "Customer reports unresolved order issue after three support calls."
}

# Conversational format — a list of role/content turns, for chat-style fine-tuning
{
    "conversations": [
        {"role": "user", "content": "What's your return policy?"},
        {"role": "assistant", "content": "You can return any item within 30 days for a full refund."}
    ]
}

# Plain text format — for continued pretraining / domain adaptation rather than instruction tuning
{"text": "The quarterly report indicates a 12% increase in revenue, driven primarily by..."}
```

**Choose the format matching your goal**: instruction format for task-specific
behavior (summarization, classification, extraction), conversational format for
chat/dialogue behavior, plain text format only for domain adaptation (teaching
the model a vocabulary/style by exposure, not a specific input→output task) —
which is a less common and generally less sample-efficient goal than instruction
tuning for most practical applications.

## Chat templates — apply the base model's own template

```python
from unsloth.chat_templates import get_chat_template

tokenizer = get_chat_template(
    tokenizer,
    chat_template="llama-3.1",   # match the base model's actual expected template
)

def formatting_func(examples):
    convos = examples["conversations"]
    texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False)
             for convo in convos]
    return {"text": texts}

dataset = dataset.map(formatting_func, batched=True)
```

**This is the single most consequential step in dataset preparation.** Every
base model has a specific chat template it was originally trained with (special
tokens marking turn boundaries, role labels, system prompt placement) — training
with the wrong template teaches the model an inconsistent pattern, and using a
different template at inference time than you trained with is **the most common
cause of a fine-tuned model producing gibberish, infinite generation, or
repeated output** once exported to Ollama, llama.cpp, or vLLM (see
`troubleshooting.md`). Always use `unsloth.chat_templates.get_chat_template`
with the correct template name for your specific base model family.

## Loading and formatting a dataset end to end

```python
from datasets import load_dataset
from unsloth.chat_templates import get_chat_template

dataset = load_dataset("your_org/your_dataset", split="train")

tokenizer = get_chat_template(tokenizer, chat_template="llama-3.1")

def formatting_prompts_func(examples):
    convos = examples["conversations"]
    texts = [tokenizer.apply_chat_template(c, tokenize=False, add_generation_prompt=False) for c in convos]
    return {"text": texts}

dataset = dataset.map(formatting_prompts_func, batched=True)
```

## Building a dataset from your own raw data

```python
from datasets import Dataset

raw_examples = [
    {"instruction": "...", "input": "...", "output": "..."},
    # ... your examples
]

def to_conversation(example):
    return {
        "conversations": [
            {"role": "user", "content": f"{example['instruction']}\n\n{example['input']}"},
            {"role": "assistant", "content": example["output"]},
        ]
    }

dataset = Dataset.from_list(raw_examples).map(to_conversation)
```

For anything beyond a toy example, build the dataset programmatically from your
actual source data (support tickets, documents, structured records) rather than
hand-writing examples one at a time — but always manually spot-check a sample
of the generated conversations before training, since bugs in a formatting
function silently corrupt every single training example the same way.

## Train/eval split — always hold out data

```python
new_dataset = dataset.train_test_split(
    test_size=0.01,     # or an integer for an exact row count
    shuffle=True,         # always True — never train on an unshuffled sequential split
    seed=3407,
)
train_dataset = new_dataset["train"]
eval_dataset = new_dataset["test"]
```

**Always shuffle before splitting** — an unshuffled split risks training and
eval sets drawn from different underlying distributions (e.g., if your raw data
is grouped by date or category), which silently invalidates the eval set as a
genuine held-out measure of generalization. See `evaluation.md` for how this
eval set gets used during and after training.

## How much data do you actually need

There's no universal number, but practical guidance from the field: **a few
hundred high-quality, focused examples is often enough** to teach a clear,
narrow behavior (a specific output format, a consistent tone, a well-defined
classification task) — datasets with 77,000+ examples exist for more ambitious
domain-adaptation projects, but starting with hundreds rather than tens of
thousands is the more common, more tractable starting point for most
applications. **Diminishing returns set in well before "more data" stops
helping entirely** — a smaller, cleaner dataset iterated on quickly (train,
evaluate, identify failure patterns, add targeted examples addressing those
specific failures) usually beats a large dataset assembled once upfront without
that feedback loop.

## Data quality checklist

1. **Consistency** — do all examples follow the same format/structure? Mixed
   formats teach the model an inconsistent pattern.
2. **Correctness** — is every output actually correct/desirable? A single
   consistently-wrong pattern in the data teaches the model that wrong pattern
   just as reliably as a correct one would teach the right one.
3. **Diversity within the task** — does the dataset cover the range of
   inputs the model will actually see in production, not just the easy/common
   cases?
4. **No leakage between train and eval** — verify near-duplicate examples
   aren't split across train and eval, which would make eval scores
   artificially optimistic.
5. **Appropriate length** — examples wildly exceeding your chosen
   `max_seq_length` get silently truncated, corrupting the training signal;
   check your data's length distribution against your configured sequence
   length before training.

## Practical guidance

1. **Match the chat template to the exact base model family** — this is the
   single highest-value thing to get right in dataset preparation.
2. **Manually spot-check formatted examples** before training, every time —
   don't trust a formatting function blindly.
3. **Always shuffle before train/eval splitting.**
4. **Start with a smaller, cleaner dataset and iterate** rather than assembling
   a large dataset upfront without a feedback loop.
5. **Check your data's length distribution against `max_seq_length`** before
   training — silent truncation is a common, hard-to-notice source of
   degraded results.