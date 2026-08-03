# Beginner → Advanced Learning Path (Unsloth Fine-Tuning)

Use this as a curriculum when the user wants a structured roadmap rather than a
point answer. Each phase names the reference file(s) to pull detail from, and
builds toward one cumulative fine-tuning project.

## Phase 0 — Orientation (20 minutes)

- Understand the fine-tuning vs. RAG vs. prompting decision table in
  `SKILL.md` — confirm fine-tuning is genuinely the right tool before
  proceeding further.
- Understand LoRA vs. QLoRA and why QLoRA is the practical default.
- Set up a free Google Colab account with a T4 GPU as your initial environment.

**Practice:** Run Unsloth's quick-start snippet from `SKILL.md` end to end on
a small public dataset, just to confirm the environment works before designing
your own project.

## Phase 1 — Setup and Model Selection

*Read: `references/setup_and_models.md`*

1. Install Unsloth and confirm GPU access in your environment.
2. Choose a base model appropriate for your task and hardware (default: a
   7-8B Instruct model on a free Colab T4).
3. Understand the VRAM budget breakdown and what to reduce first if you hit
   limits.

**Practice:** Load your chosen base model with `FastLanguageModel.from_pretrained`
and run a few baseline generations before any fine-tuning — this becomes your
comparison point in Phase 5.

## Phase 2 — Dataset Preparation

*Read: `references/dataset_preparation.md`*

1. Define your target task precisely — what specific behavior are you
   teaching?
2. Assemble a few hundred high-quality examples in the appropriate format
   (instruction or conversational).
3. Apply the correct chat template for your chosen base model via
   `get_chat_template`.
4. Manually read through 10-20 formatted examples to catch bugs before
   training.
5. Split into train/eval with shuffling.

**Practice project:** Pick a concrete, narrow task (e.g., "summarize support
tickets into a consistent one-line format," "convert casual text into a
specific formal tone," "extract structured fields from unstructured text")
and build a real dataset of 200-500 examples for it — this becomes your
project for the rest of the learning path.

## Phase 3 — LoRA Hyperparameters

*Read: `references/lora_hyperparameters.md`*

1. Start entirely at Unsloth's recommended defaults.
2. Understand what each parameter actually controls, even though you're not
   changing them yet.
3. Understand the "LoRA needs a HIGHER learning rate than full fine-tuning"
   point specifically — it's a common, backwards intuition.

**Practice:** Before training, write down your prediction for what would
happen if you doubled the rank, or dropped the learning rate by 10x — then
verify (or fail to verify) your prediction empirically in Phase 4.

## Phase 4 — Training

*Read: `references/training.md`*

1. Configure `SFTTrainer`/`SFTConfig` with an eval set included from the
   start.
2. Run a first training pass at defaults (1 epoch is fine for a first pass).
3. Watch the loss curve — does it trend downward smoothly, plateau
   immediately, or spike?

**Practice project:** Train your Phase 2 dataset at Unsloth's default
hyperparameters for 1-3 epochs, actually watching the loss log as it runs.

## Phase 5 — Evaluation

*Read: `references/evaluation.md`*

1. Compare eval loss against train loss — look for divergence.
2. Build a small, fixed qualitative test set and run it against both the base
   model and your fine-tuned model.
3. Run a lightweight catastrophic-forgetting check on prompts unrelated to
   your task.

**Practice project:** Write out a side-by-side comparison (base model vs.
fine-tuned model) on 5-10 test prompts from your target task, plus 3-5
unrelated general-knowledge prompts — this is the artifact that actually
tells you whether the fine-tune worked.

## Phase 6 — Iterate on Hyperparameters (if needed)

*Read: `references/lora_hyperparameters.md` (the tuning workflow section) +
`references/troubleshooting.md`*

1. If Phase 5 revealed underfitting, overfitting, or instability, apply the
   specific diagnostic-driven fix for that category — not a random parameter
   change.
2. Re-train and re-evaluate.

**Practice:** If your first run wasn't satisfactory, make exactly one
targeted change based on the diagnosis, re-train, and confirm whether it
actually addressed the specific problem you identified — building the habit
of diagnose-then-fix rather than parameter-guessing.

## Phase 7 — Export and Deployment

*Read: `references/export_and_deployment.md`*

1. Save an adapter-only version first (fastest, smallest).
2. Merge to 16-bit.
3. Export to GGUF at `q4_k_m`.
4. Deploy to Ollama locally and confirm the model responds correctly.

**Practice project:** Get your fine-tuned model actually running in Ollama
end to end — this closes the loop from "trained a model" to "have a usable
local model," and is where chat-template mismatches most often surface for
the first time.

## Phase 8 — Troubleshooting Practice

*Read: `references/troubleshooting.md`*

1. If Phase 7 produced gibberish or broken output, work through the chat
   template mismatch checklist specifically.
2. If you hit any OOM errors anywhere in this path, work through the ordered
   fix list.

**Practice:** Even if your project went smoothly, deliberately introduce a
chat template mismatch (e.g., use a different template name at inference
than you trained with) and observe the broken behavior — recognizing this
failure mode by sight is more valuable than only reading about it.

## Phase 9 — Advanced Techniques (optional, as needed)

*Read: `references/advanced_techniques.md`*

1. If your task is genuinely comparison/preference-shaped rather than
   single-answer-shaped, read the DPO section.
2. If working with images, read the vision fine-tuning section.
3. Understand where GRPO/RL approaches fit, even if not using them yet.

**Practice:** Only pursue this phase if Phase 5's evaluation revealed a
specific gap that plain SFT didn't address — don't add DPO or other advanced
techniques speculatively.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer
with a specific production fine-tuning task):
- Build one cumulative project (a single, well-defined narrow task) across
  all phases rather than disconnected examples.
- Insist on Phase 0's fine-tuning-vs-RAG-vs-prompting check even if it feels
  like a delay — it's common for learners to want to fine-tune something that
  would actually be better served by RAG or better prompting, and catching
  this early saves significant wasted effort.
- Check understanding with a quick prediction exercise before running
  something — e.g., "before we train, what do you expect to happen to the
  loss curve, and why?" — this builds the diagnostic intuition that matters
  more than any specific hyperparameter value.
- Emphasize Phase 5 (evaluation) and Phase 8 (chat template troubleshooting)
  as the two most commonly under-invested steps in real projects — most
  fine-tuning failures trace back to skipping one of these, not to a
  fundamentally wrong approach.