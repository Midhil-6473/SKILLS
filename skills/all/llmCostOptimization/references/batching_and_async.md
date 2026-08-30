# Batch APIs and Async Processing

## The core trade-off: latency for cost

Both OpenAI and Anthropic offer batch processing endpoints at roughly **50%
off standard pricing**, in exchange for asynchronous, non-real-time
completion (typically within a 24-hour window rather than immediately).
**This is a "free" 50% discount for any workload that doesn't require a
user waiting on the response** — the only cost is architectural (your
pipeline needs to handle asynchronous completion), not a quality or capability
trade-off at all.

## Workloads that fit batch processing well

- **Nightly report generation** — summaries, analytics digests, scheduled
  content.
- **Classifying or labeling large document sets** — content moderation
  backlogs, dataset annotation, bulk categorization.
- **Bulk content generation** — marketing copy variants, product description
  generation at scale.
- **RAG index enrichment** — generating embeddings-adjacent metadata,
  summaries, or synthetic Q&A pairs for a document corpus (see this
  collection's `llamaindex-architect` skill) — an ingestion-time process that
  rarely needs to be real-time.
- **Offline evaluation runs** — running a large eval suite (see this
  collection's `pydantic-architect` and `ab-testing-experimentation` skills)
  is itself a batch-shaped workload; running it through a batch endpoint can
  meaningfully cut the cost of maintaining a thorough eval harness.

## Workloads that do NOT fit batch processing

**Reserve real-time API calls specifically for user-facing requests where
someone is actively waiting for a response** — a chat interface, an
interactive agent, any synchronous product feature. Attempting to batch these
either breaks the product experience (users won't wait 24 hours for a chat
reply) or requires building a real-time fallback anyway, which undermines the
cost benefit.

## Implementation pattern

```python
import anthropic

client = anthropic.Anthropic()

# Submit a batch of requests
batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": f"doc-{i}",
            "params": {
                "model": "claude-sonnet-4-6",
                "max_tokens": 500,
                "messages": [{"role": "user", "content": f"Summarize: {doc}"}],
            },
        }
        for i, doc in enumerate(document_batch)
    ]
)

# Poll for completion (or use a webhook/callback if the provider supports one)
while True:
    status = client.messages.batches.retrieve(batch.id)
    if status.processing_status == "ended":
        break
    time.sleep(60)

results = client.messages.batches.results(batch.id)
```

**Design the surrounding pipeline for asynchronous completion from the
start** — a job queue or workflow orchestrator (see this collection's
`docker-k8s-mlops` skill for job-queue infrastructure patterns) that submits
a batch, tracks its status, and processes results once available, rather than
a synchronous request path that happens to call a batch endpoint and blocks
waiting for it (which defeats the purpose and can even time out, since batch
completion windows are measured in hours, not seconds).

## Provider availability differs — check before designing around it

Batch API availability and terms vary by provider — for example, at points in
2026, some providers' batch offerings have differed in scope and integration
path from others (some accessible directly via the provider's own API, others
requiring routing through a specific cloud platform's managed offering).
**Verify current batch API availability and terms for your specific provider
and model before committing pipeline architecture to it** — this is exactly
the kind of provider-specific detail that changes over time and should be
checked against current documentation rather than assumed.

## Combining batching with other levers

Batch processing composes naturally with prompt caching (`prompt_caching.md`)
— a batch of requests sharing a common static prefix (the same system
prompt, the same instructions, applied across many documents) can still
benefit from cache discounts on top of the batch discount, compounding the
savings for large-scale offline workloads specifically.

## Practical guidance

1. **Audit your workloads for anything that doesn't need a real-time
   response** — reports, bulk classification, index enrichment, eval runs —
   and move it to batch processing as a close-to-free 50% saving.
2. **Never batch user-facing, latency-sensitive requests** — the discount
   isn't worth breaking the product experience, and building a real-time
   fallback anyway erodes the benefit.
3. **Design the pipeline for async completion from the start** — a job
   queue polling/webhook pattern, not a synchronous code path awkwardly
   wrapped around a batch call.
4. **Check current provider-specific batch API availability and terms**
   before committing architecture to a specific provider's batch offering.
5. **Combine batching with prompt caching** for large offline workloads
   sharing a common static prefix, compounding the savings.