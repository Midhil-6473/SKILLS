# Exporting and Deploying — Adapters, Merging, GGUF, Ollama/vLLM/llama.cpp

## The three export paths

| Export type | What it produces | Use when |
|---|---|---|
| **Adapter-only** | A small (~100MB-few-hundred-MB) LoRA adapter file | You'll load the base model + adapter together at inference time; smallest footprint, requires the base model separately |
| **Merged (16-bit)** | A full-size model with adapter weights merged into the base | You want a single, standalone model file; needed as an intermediate step before GGUF conversion |
| **GGUF (quantized)** | A quantized, standalone model file for `llama.cpp`-based tools | Deploying to Ollama, LM Studio, or any `llama.cpp`-based local inference — the most common deployment target for fine-tuned open models |

## Adapter-only save — the smallest, fastest option

```python
model.save_pretrained("lora_model")       # saves only the adapter weights
tokenizer.save_pretrained("lora_model")
```

```python
# Push to Hugging Face Hub instead of / in addition to local save
model.push_to_hub("your-username/my-finetuned-adapter", token="hf_...")
tokenizer.push_to_hub("your-username/my-finetuned-adapter", token="hf_...")
```

**You need the original base model present at inference time** to use an
adapter-only save — this is the right choice when you're deploying via a
framework (like `peft` or `vLLM` with LoRA support) that natively loads a base
model + adapter combination, rather than needing one merged, self-contained
file.

## Merging into a full 16-bit model

```python
model.save_pretrained_merged("merged_model", tokenizer, save_method="merged_16bit")

# Or push directly to the Hub
model.push_to_hub_merged("your-username/my-finetuned-model", tokenizer, save_method="merged_16bit")
```

This produces a full-size, standalone model — no separate adapter-loading step
needed at inference. This is also the required intermediate step before GGUF
conversion for models needing custom merge handling.

**Critical gotcha: quantization-and-merge ordering.** If you fine-tuned with
QLoRA (a 4-bit quantized base), the base model must be **dequantized to
FP16/BF16 before merging** the adapter weights in. Calling a merge operation
directly on a still-4-bit model causes real precision loss — Unsloth's
`save_pretrained_merged`/`push_to_hub_merged` handle this dequantization
correctly internally, which is precisely why you should use these methods
rather than manually reimplementing the merge with lower-level `peft` calls
unless you have a specific reason to.

## GGUF export — for Ollama, llama.cpp, LM Studio

```python
# Save locally
model.save_pretrained_gguf("finetuned_model", tokenizer, quantization_method="q4_k_m")

# Or push to the Hub
model.push_to_hub_gguf("your-username/my-finetuned-gguf", tokenizer, quantization_method="q4_k_m")
```

### Quantization method selection

| Method | Size vs. f16 | Quality | Use when |
|---|---|---|---|
| `f16` | 100% (no size reduction) | Highest | You have ample storage/VRAM and want minimal quality loss |
| `q8_0` | ~50% | Very close to f16 | A good balance when quality matters and some size reduction is welcome |
| **`q4_k_m`** | ~25-30% | Solid | **The standard recommended default** — the best balance of file size and quality for most local deployment |
| Other `q*` variants | Varies | Varies | Specialized trade-offs — consult current Unsloth docs for the full list, as options evolve |

**`q4_k_m` is the right default for most deployment scenarios** — meaningfully
smaller than f16/q8_0 while retaining solid quality; reach for f16 or q8_0
specifically when quality is paramount and storage/VRAM headroom allows it.

## Deploying to Ollama

```bash
# 1. Export to GGUF (as above), producing e.g. finetuned_model/model-q4_k_m.gguf

# 2. Create a Modelfile pointing at the GGUF file
cat > Modelfile << 'EOF'
FROM ./finetuned_model/model-q4_k_m.gguf
TEMPLATE """{{ .System }}
{{ .Prompt }}"""
EOF

# 3. Register with Ollama
ollama create my-finetuned-model -f Modelfile
ollama run my-finetuned-model
```

**If Unsloth's export includes an Ollama Modelfile in the output** (it often
generates one automatically alongside the GGUF file), Ollama will use that
directly and auto-detect the correct chat template for known architectures —
prefer this over hand-writing a `TEMPLATE` block, since a hand-written template
that doesn't exactly match training is the single most common cause of broken
post-export behavior.

## The #1 post-export problem: chat template mismatch

**If your model produces gibberish, infinite generation, or repeated output
after exporting to Ollama, llama.cpp, or vLLM — but worked correctly inside
Unsloth during training/testing — the cause is almost always a chat template
mismatch.** It is essential to use the **exact same chat template** at
inference time (in whatever framework you deploy to) that you used during
training (see `dataset_preparation.md`). Two specific things to verify:

1. **The template itself matches** — role labels, turn-boundary tokens, and
   overall structure must be identical between training and inference.
2. **The EOS (end-of-sequence) token is correct** — an incorrect EOS token
   causes gibberish specifically on longer generations, since the model never
   receives a clear "stop here" signal matching what it was trained to
   recognize.

Also check for a **double or missing BOS (beginning-of-sequence) token** —
some inference engines automatically add a BOS token; if your chat template
also includes one, you can end up with a duplicate that confuses the model
(Unsloth's export process specifically detects and handles this case for
known architectures, temporarily removing a redundant BOS token during
merging when it identifies this situation).

## Deploying to vLLM

```python
from vllm import LLM, SamplingParams

llm = LLM(model="your-username/my-finetuned-model")   # merged 16-bit model, or GGUF with vLLM's GGUF support
sampling_params = SamplingParams(temperature=0.7, max_tokens=256)

outputs = llm.generate(["Your prompt here"], sampling_params)
```

vLLM is the standard choice for **production-scale serving** (high throughput,
continuous batching) rather than local/single-user inference — see this
collection's `docker-k8s-mlops` skill (`model_serving_frameworks.md`) for the
broader context of when to reach for vLLM/Triton/KServe versus a simpler
serving setup, and for containerizing/deploying whichever serving stack you
choose to a real production environment.

## Manual GGUF conversion (when Unsloth's built-in export needs troubleshooting)

```bash
# If the built-in save_pretrained_gguf path has issues, convert manually via llama.cpp directly
python llama.cpp/convert_hf_to_gguf.py merged_model \
    --outfile model-Q8_0.gguf --outtype q8_0 --split-max-size 50G
```

Requires a local `llama.cpp` checkout — useful as a fallback when the automatic
GGUF export path hits an environment-specific issue (missing `llama.cpp`
directory, an unsupported architecture in the bundled conversion script), since
it gives you direct visibility into and control over the conversion step.

## Practical guidance

1. **Choose your export path based on deployment target**: adapter-only for
   frameworks that load base+adapter natively, merged 16-bit as an intermediate
   or for direct use, GGUF for Ollama/llama.cpp/LM Studio.
2. **Never merge a still-quantized (4-bit) model directly** — use Unsloth's
   `save_pretrained_merged`/`push_to_hub_merged`, which handle the required
   dequantization step correctly.
3. **Default to `q4_k_m` quantization** for GGUF exports unless you have a
   specific reason to prioritize quality over size.
4. **Treat chat template mismatch as your first hypothesis** whenever a model
   behaves well in Unsloth but poorly after export — check the template, the
   EOS token, and BOS token handling, in that order.
5. **Prefer an auto-generated Ollama Modelfile over hand-writing one**, when
   Unsloth provides it — reduces the surface area for template mismatch errors.