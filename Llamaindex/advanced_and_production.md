# Evaluation, Observability, LlamaCloud & Production Patterns

## Evaluation — measuring RAG quality

Two distinct evaluation surfaces: **retrieval quality** (did we find the right chunks?)
and **response quality** (is the generated answer good?).

### Response evaluation

```python
from llama_index.core.evaluation import FaithfulnessEvaluator, RelevancyEvaluator

faithfulness_evaluator = FaithfulnessEvaluator(llm=llm)
relevancy_evaluator = RelevancyEvaluator(llm=llm)

response = query_engine.query("What is the refund policy?")

faithfulness_result = faithfulness_evaluator.evaluate_response(response=response)
relevancy_result = relevancy_evaluator.evaluate_response(query="What is the refund policy?", response=response)

print(faithfulness_result.passing)  # True/False — is the answer grounded in retrieved context?
print(relevancy_result.passing)     # True/False — is the answer relevant to the query?
```

| Evaluator | Measures |
|---|---|
| `FaithfulnessEvaluator` | Is the response hallucinated, or grounded in retrieved context? |
| `RelevancyEvaluator` | Does the response actually answer the query? |
| `CorrectnessEvaluator` | Does the response match a ground-truth reference answer? |
| `GuidelineEvaluator` | Does the response follow custom guidelines you define? |

### Retrieval evaluation

```python
from llama_index.core.evaluation import RetrieverEvaluator

retriever_evaluator = RetrieverEvaluator.from_metric_names(
    ["mrr", "hit_rate"], retriever=retriever
)
eval_results = await retriever_evaluator.aevaluate_dataset(eval_dataset)
```

`hit_rate`: did the correct chunk appear in top-k at all? `mrr` (Mean Reciprocal Rank):
how high up was the correct chunk ranked?

### Generating synthetic eval datasets

```python
from llama_index.core.evaluation import generate_question_context_pairs

qa_dataset = generate_question_context_pairs(
    nodes, llm=llm, num_questions_per_chunk=2
)
```

LLM-generates Q&A pairs from your own nodes, giving you a ground-truth eval set without
manual labeling — useful to bootstrap evaluation before you have real user queries.

## Cost analysis

```python
from llama_index.core.callbacks import CallbackManager, TokenCountingHandler
import tiktoken

token_counter = TokenCountingHandler(tokenizer=tiktoken.encoding_for_model("gpt-4o").encode)
Settings.callback_manager = CallbackManager([token_counter])

# ... run queries ...

print(token_counter.total_embedding_token_count)
print(token_counter.prompt_llm_token_count)
print(token_counter.completion_llm_token_count)
```

Track embedding vs. LLM token costs separately — embedding costs scale with corpus size
(one-time-ish), LLM costs scale with query volume (ongoing).

## Observability / tracing

```python
from llama_index.core import set_global_handler

set_global_handler("arize_phoenix")   # Open-source, self-hostable
# set_global_handler("wandb")
# set_global_handler("langfuse")
# set_global_handler("simple")        # Basic console logging, no external service
```

For finer control, use the `Instrumentation` module (newer, more granular than callbacks):

```python
from llama_index.core.instrumentation import get_dispatcher
dispatcher = get_dispatcher()
# Attach custom event handlers / span handlers for detailed tracing
```

## LlamaCloud — managed services

LlamaCloud (`cloud.llamaindex.ai`) is the managed/enterprise layer on top of open-source
LlamaIndex:

| Service | What it does |
|---|---|
| **LlamaParse** | Best-in-class document parsing (VLM-powered) for complex PDFs, tables, charts |
| **LlamaExtract** | Schema-defined structured data extraction from any document |
| **LlamaCloud Index/Retrieval** | Fully managed e2e ingestion + indexing + retrieval pipeline — connect a data source (SharePoint, GDrive, S3) and a vector DB sink, LlamaCloud handles syncing |

```python
from llama_cloud_services import LlamaParse

parser = LlamaParse(api_key="llx-...", result_type="markdown")
documents = await parser.aload_data("complex_doc.pdf")
```

```python
# Using a fully-managed LlamaCloudIndex
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex

index = LlamaCloudIndex.from_documents(
    documents,
    name="my-managed-index",
    project_name="my-project",
    api_key="llx-...",
)
query_engine = index.as_query_engine()
```

10,000 free credits/month; paid plans for larger volumes; both SaaS and self-hosted options.

## Production checklist

1. **Set `Settings.llm` and `Settings.embed_model` explicitly** — never rely on the default.
2. **Use a persistent vector store** (Chroma, Pinecone, Qdrant, pgvector) — never ship
   in-memory indexes to production.
3. **Use `IngestionPipeline` with a docstore** for deduplication and incremental updates.
4. **Tune chunk size for your domain** — don't ship the 1024-token default blindly.
5. **Add reranking** — retrieve top_k=20-50, rerank to top_n=3-5 before the LLM call.
6. **Set up evaluation** before shipping — faithfulness + relevancy at minimum.
7. **Add observability** (Phoenix, Langfuse, or similar) from day one — debugging RAG
   in production without traces is extremely painful.
8. **Track token costs** separately for embedding vs. generation.
9. **Handle prompt injection** in retrieved content with explicit system prompt instructions.
10. **Use async** (`aquery`, `arun`, `pipeline.arun`) for any production-traffic-serving code.
11. **Cache aggressively** — embeddings for unchanged documents, LLM responses for
    repeated queries where appropriate.
12. **Version your index** — when you change chunking strategy or embedding model, you
    must re-index from scratch; old vectors are incompatible with new embedding models.

## Privacy and security

LlamaIndex docs explicitly note: be deliberate about what metadata gets sent to the LLM
vs. embedded vs. only used for filtering. Use `excluded_llm_metadata_keys` and
`excluded_embed_metadata_keys` on `Document`/`Node` objects to keep sensitive fields
(e.g., internal IDs, PII) out of prompts while still using them for retrieval filtering.

```python
doc = Document(
    text="...",
    metadata={"user_email": "alice@example.com", "category": "support"},
    excluded_llm_metadata_keys=["user_email"],   # Don't leak email into LLM prompt
)
```