# Agentic and RAG-Specific Cost Patterns

## Why agentic systems have a fundamentally different cost shape

A single-turn chat request costs roughly one input-token charge and one
output-token charge. An **agent** (see this collection's `langchain-architect`,
`pydantic-architect`, and `mcp-architect` skills) can make many LLM calls per
user request — reasoning steps, tool calls, tool-result processing, possibly
sub-agent delegation — each one re-paying the accumulated context cost of
everything before it in that run. **Cost in agentic systems scales with the
number of steps, not just the number of user requests**, and this is easy to
underestimate when a demo with 2-3 tool calls looks cheap but production
usage patterns involve much longer agent trajectories.

## Multi-agent systems carry a real, quantifiable cost multiplier

Running multiple agents in parallel and merging their outputs (a common
pattern — see `langchain-architect`'s multi-agent coverage) **can cost 4-15x
more tokens** than a single well-designed agent call, because each parallel
agent independently re-pays context costs and the merge step adds further
overhead. **This is not a reason to avoid multi-agent architectures
outright** — for genuinely independent subtasks where parallelism provides
real quality or latency benefit, the cost multiplier can be worth it — but it
is a reason to treat "should this be multi-agent" as a deliberate cost/benefit
decision, not a default architecture choice. **Reserve multi-agent
specifically for tasks that are truly independent and benefit from
parallelism**, not as a default way to structure any moderately complex task.

## Tool definition overhead compounds across every agent step

As covered in `token_economics.md`, every tool schema is resent as input on
every call. In a multi-step agent loop, this cost is paid **on every single
step**, not once per user request — an agent with 15 tools running a 6-step
reasoning trajectory pays for those 15 tool definitions 6 times over in that
one user interaction.

**Mitigations**:
- **Prune the tool list to what's actually relevant** for a given
  conversation/context where possible, rather than always exposing every
  tool the agent could theoretically use (see `mcp-architect`'s coverage of
  tool-selection middleware for one concrete mechanism).
- **Keep tool descriptions concise** — thorough enough for correct selection
  (a real requirement — see `mcp-architect`'s and `pydantic-architect`'s
  guidance on tool docstring quality) but not padded with redundant detail
  that adds token cost without improving selection accuracy.
- **Structure the agent's system prompt and tool definitions as the cacheable
  prefix** (see `prompt_caching.md`) — since these are genuinely static
  across a session, they're exactly the content prompt caching is designed
  to make cheap on repeated calls within an agent's multi-step loop.

## RAG-specific cost patterns

**Retrieved context is a major, variable cost driver** — the chunk size,
number of chunks (`top_k`), and reranking strategy (see this collection's
`llamaindex-architect` skill) directly determine how many tokens get paid
for on every query, independent of the actual model used.

```python
# A naive RAG call pays for ALL retrieved chunks on every query, in full
retrieved_chunks = vector_store.similarity_search(query, k=20)   # 20 chunks, always
context = "\n\n".join(chunk.text for chunk in retrieved_chunks)   # potentially huge

# A cost-conscious version reranks down before sending to the LLM,
# and considers whether 20 initial chunks were ever necessary for retrieval quality
retrieved_chunks = vector_store.similarity_search(query, k=20)
reranked = rerank(retrieved_chunks, query, top_n=5)   # send only the best 5, not all 20
```

This is the same retrieve-then-rerank pattern covered in this collection's
`llamaindex-architect` skill (`querying_and_retrieval.md`) — worth
highlighting here specifically through a **cost** lens: reranking down before
sending to the LLM isn't just a quality improvement (less irrelevant context
diluting the answer), it's also a direct, often substantial token-cost
reduction, since you're paying for far fewer context tokens per query.

**Chunk size and prompt compression** (`semantic_caching_and_compression.md`)
apply particularly well to RAG specifically — retrieved chunks are exactly
the kind of content compression tools like LLMLingua are designed for, since
retrieved context is often redundant (multiple chunks repeating similar
information) in a way instructions/system prompts typically aren't.

## Retry and self-correction loops — a hidden cost multiplier

Agentic patterns that involve the model checking/critiquing/retrying its own
output (a common quality-improvement technique) directly multiply token
cost — each retry re-pays input context cost and adds a full additional
output generation. **This is a genuine quality/cost trade-off worth making
deliberately**: a single well-prompted, precise generation is frequently
better value than a generate-critique-retry loop, especially once the
`max_tokens`/stop-sequence and output-format disciplines from
`token_economics.md` are already applied to make the first attempt more
likely to succeed. Reserve iterative refinement loops for tasks where the
quality gain is empirically validated (via your eval harness) to outweigh
the multiplied cost, rather than defaulting to "have it check its own work"
as a blanket quality tactic.

## Practical guidance

1. **Model agentic cost as scaling with steps, not just requests** — a demo's
   cost profile with 2-3 tool calls does not predict production cost once
   real usage involves longer trajectories.
2. **Treat multi-agent architectures as a deliberate cost/benefit decision**
   (4-15x token multiplier is real) — reserve them for genuinely independent,
   parallelism-benefiting subtasks, not as a default structuring choice.
3. **Prune and concisely describe tool definitions** — this cost compounds
   across every step of an agent's trajectory, not just once per request.
4. **Rerank RAG results down before sending to the LLM** — this is
   simultaneously a quality and a cost lever, not a trade-off between the two.
5. **Validate retry/self-correction loops against your eval harness** before
   adopting them as a default pattern — the cost multiplier is real and the
   quality benefit needs to be measured, not assumed.