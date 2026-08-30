# Semantic Caching and Prompt Compression

## Semantic caching — catching near-duplicate queries

Unlike prompt caching's exact-prefix matching (`prompt_caching.md`),
**semantic caching** operates at the application level: embed each incoming
query, compare it against embeddings of previously-answered queries, and if
similarity exceeds a threshold, return the cached *response* directly —
**bypassing the model call entirely**, saving both input and output tokens
(prefix caching only saves input tokens).

```python
from your_vector_store import similarity_search

def semantic_cache_lookup(query: str, similarity_threshold: float = 0.95) -> str | None:
    query_embedding = embed(query)
    results = similarity_search(query_embedding, k=1)
    if results and results[0].score >= similarity_threshold:
        return results[0].cached_response   # skip the LLM call entirely
    return None

def answer_query(query: str) -> str:
    cached = semantic_cache_lookup(query)
    if cached is not None:
        return cached
    response = call_llm(query)
    store_in_cache(query, response)
    return response
```

**The similarity threshold is a real precision/recall trade-off, not a free
parameter to set aggressively.** A threshold too loose returns a cached
response for a query that's actually meaningfully different — a genuinely
wrong answer served confidently, which is a worse failure mode than simply
paying for a fresh model call. A threshold too tight rarely triggers,
providing little savings. **Approaches with user-defined error-rate
guarantees** (returning a cached response only when the estimated risk of a
wrong answer stays under an explicit bound you set) are an emerging,
more principled alternative to picking a raw similarity cutoff by feel.

## Where semantic caching helps most

- **High query repetition with paraphrase variation** — FAQ-style systems,
  customer support, anything where many users ask "the same question" in
  different words.
- **Expensive-to-generate responses** — long-form answers, complex
  multi-step agent outputs, anything where the output-token cost (which
  semantic caching saves, unlike prefix caching) is substantial.

## Where semantic caching is risky

- **Queries requiring current/personalized information** — caching a
  response to "what's my order status" is actively wrong the moment the
  underlying data changes; semantic caching fits static-answer domains far
  better than dynamic, personalized, or time-sensitive ones.
- **High-stakes domains** where an occasionally-wrong "close enough" match
  has real consequences (medical, legal, financial guidance) — the
  similarity-threshold risk described above is much less acceptable here.

## Prompt compression — trimming redundant context

Tools like **LLMLingua** can compress prompts significantly (reported up to
~20x in some cases) while preserving the model's ability to answer
correctly — particularly effective for RAG pipelines with long, often
redundant retrieved chunks.

```python
from llmlingua import PromptCompressor

compressor = PromptCompressor()
compressed_prompt = compressor.compress_prompt(
    long_retrieved_context,
    rate=0.5,             # target compression ratio
    force_tokens=["\n", "?"],   # preserve tokens critical to structure/meaning
)
```

**Compression is not free of quality risk** — over-aggressive compression or
compressing content the task genuinely needs in full detail can silently
degrade output quality in ways that don't show up as an obvious error, only
as a subtly worse answer. Always validate compressed-prompt quality against
your eval harness before shipping, at the same rigor you'd apply to a model
swap or a routing change (see `SKILL.md`'s core best practices) — compression
is a genuine lever, not a free win.

## Structural techniques that reduce tokens without compression tooling

```
- Use structured output formats (JSON schemas, fixed categories) rather than
  open-ended prose where the task allows it — the model produces less,
  and downstream parsing is more reliable as a side benefit.
- Use clear stop sequences to prevent over-generation past the useful answer.
- Replace "dump the whole document/repo into context" patterns with targeted
  retrieval (see this collection's llamaindex-architect and
  langchain-architect skills) — send only what's relevant, not everything
  potentially relevant.
- For agentic workflows, reset context between distinct phases of a task
  rather than letting a single session's history grow unbounded — a fresh
  context for "now implement what we just planned" avoids re-paying for the
  entire planning conversation's tokens on every subsequent turn.
- Use a knowledge graph or structured summary of accumulated context instead
  of raw conversation history, where the task allows it — trading some
  fidelity for a substantial, compounding token reduction across a long
  session.
```

**The "reset context between phases" pattern deserves particular attention**
for agentic systems: a coding agent that plans in one long session and then
implements in that same session re-pays the entire planning conversation's
token cost on every subsequent turn of implementation. Splitting into a
"planning" phase and a fresh "implementation" phase (carrying forward only
the distilled plan, not the full planning transcript) is free to implement
and directly reduces token usage on every turn after the split.

## Practical guidance

1. **Reserve semantic caching for domains with genuinely static, repeatable
   answers** — avoid it for personalized, time-sensitive, or high-stakes
   queries where a wrong "close enough" match has real cost.
2. **Treat the similarity threshold as a tuned parameter validated against
   real outcomes**, not a default left at whatever a library ships with.
3. **Validate compressed prompts against your eval harness**, the same
   discipline as any other cost lever with quality risk.
4. **Prefer structural fixes (targeted retrieval, context resets between
   phases, structured output) before reaching for a dedicated compression
   library** — they're often free to implement and carry less risk.