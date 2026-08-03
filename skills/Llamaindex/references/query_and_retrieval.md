# Querying & Retrieval — Query Engines, Chat Engines, Retrievers, Advanced Patterns

## The querying stack

```
Query → Retriever → [Node Postprocessors] → Response Synthesizer → Answer
```

Querying is more than a single LLM call. It consists of three distinct stages:
1. **Retrieval** — find the most relevant nodes for the query
2. **Postprocessing** — filter, rerank, or transform retrieved nodes
3. **Response synthesis** — combine query + nodes into a final LLM-generated answer

## QueryEngine — the basic interface

```python
query_engine = index.as_query_engine()
response = query_engine.query("What does this document say about X?")
print(response)            # The synthesized answer
print(response.source_nodes)  # The nodes used to generate it
```

### Customizing the QueryEngine — low-level control

```python
from llama_index.core import VectorStoreIndex, get_response_synthesizer
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.postprocessor import SimilarityPostprocessor

retriever = VectorIndexRetriever(index=index, similarity_top_k=10)
response_synthesizer = get_response_synthesizer(response_mode="compact")
node_postprocessors = [SimilarityPostprocessor(similarity_cutoff=0.7)]

query_engine = RetrieverQueryEngine(
    retriever=retriever,
    response_synthesizer=response_synthesizer,
    node_postprocessors=node_postprocessors,
)
response = query_engine.query("What are the main risks?")
```

### Common query_engine kwargs (shortcut form)

```python
query_engine = index.as_query_engine(
    similarity_top_k=5,
    response_mode="tree_summarize",
    streaming=True,
)
```

## ChatEngine — multi-turn conversation

```python
chat_engine = index.as_chat_engine(chat_mode="context")
response = chat_engine.chat("What's the main topic?")
response = chat_engine.chat("Tell me more about that")  # remembers prior turn
chat_engine.reset()  # clear history
```

### Chat modes

| Mode | Behavior |
|---|---|
| `"best"` | Uses function calling agent if model supports it, else ReAct |
| `"context"` | Retrieves context every turn, injects into system prompt |
| `"condense_question"` | Condenses chat history + new message into a standalone question first |
| `"condense_plus_context"` | Combines condensing with context retrieval — usually best default |
| `"simple"` | Direct chat with LLM, no retrieval |
| `"react"` | ReAct agent loop with the query engine as a tool |

```python
chat_engine = index.as_chat_engine(
    chat_mode="condense_plus_context",
    system_prompt="You are a helpful assistant. Answer based only on the provided context.",
)
```

## Retrievers — fetching relevant nodes

```python
retriever = index.as_retriever(similarity_top_k=5)
nodes = retriever.retrieve("What is the refund policy?")
for node in nodes:
    print(node.score, node.text[:100])
```

### Retriever modes for VectorStoreIndex

```python
retriever = index.as_retriever(
    vector_store_query_mode="default",   # pure semantic
    # vector_store_query_mode="sparse",  # pure keyword (if store supports)
    # vector_store_query_mode="hybrid",  # both combined
    similarity_top_k=10,
)
```

### BM25Retriever — pure keyword search

```bash
pip install llama-index-retrievers-bm25
```
```python
from llama_index.retrievers.bm25 import BM25Retriever

bm25_retriever = BM25Retriever.from_defaults(nodes=nodes, similarity_top_k=5)
```

### Fusion retriever — combine multiple retrievers

```python
from llama_index.core.retrievers import QueryFusionRetriever

retriever = QueryFusionRetriever(
    [vector_retriever, bm25_retriever],
    similarity_top_k=5,
    num_queries=4,           # Generates query variations for better recall
    mode="reciprocal_rerank", # or "relative_score", "dist_based_score", "simple"
)
```

This is how to implement hybrid search manually when your vector store doesn't support
native hybrid mode.

## Node Postprocessors — filtering & reranking

```python
from llama_index.core.postprocessor import (
    SimilarityPostprocessor,      # Cuts nodes below a similarity threshold
    KeywordNodePostprocessor,     # Requires/excludes specific keywords
    LongContextReorder,           # Reorders for "lost in the middle" mitigation
    SentenceEmbeddingOptimizer,   # Trims node to most relevant sentences only
)

query_engine = index.as_query_engine(
    node_postprocessors=[
        SimilarityPostprocessor(similarity_cutoff=0.75),
        LongContextReorder(),
    ]
)
```

### Reranking with a cross-encoder model (huge quality boost)

Initial retrieval (top-k=20) casts a wide net; reranking picks the best subset (top-n=5).

```python
# pip install llama-index-postprocessor-cohere-rerank
from llama_index.postprocessor.cohere_rerank import CohereRerank

cohere_rerank = CohereRerank(api_key="...", top_n=5, model="rerank-english-v3.0")

query_engine = index.as_query_engine(
    similarity_top_k=20,                       # broad initial retrieval
    node_postprocessors=[cohere_rerank],        # rerank down to best 5
)
```

```python
# Or local, free cross-encoder via SentenceTransformers
# pip install llama-index-postprocessor-sbert-rerank
from llama_index.postprocessor.sbert_rerank import SentenceTransformerRerank

rerank = SentenceTransformerRerank(model="cross-encoder/ms-marco-MiniLM-L-2-v2", top_n=5)
```

**Rule of thumb:** retrieve top_k=20-50, rerank down to top_n=3-5 before sending to the LLM.
This consistently outperforms retrieving top_k=5 directly.

## Response Synthesizers — how the answer is constructed

```python
from llama_index.core import get_response_synthesizer

synthesizer = get_response_synthesizer(response_mode="compact")
```

| Response mode | Behavior |
|---|---|
| `"refine"` | Sequentially refines the answer through each node (1 LLM call per node) — thorough but slow |
| `"compact"` (default-ish) | Stuffs as many nodes as fit per LLM call, refines across calls — faster than `refine` |
| `"tree_summarize"` | Builds a summarization tree bottom-up — best for "summarize everything" queries |
| `"simple_summarize"` | Single LLM call with all nodes truncated to fit context — fastest, least thorough |
| `"no_text"` | Returns retrieved nodes only, skips LLM synthesis entirely (just retrieval) |
| `"accumulate"` | Runs the query against every node separately, concatenates all answers |

## Streaming responses

```python
query_engine = index.as_query_engine(streaming=True)
response = query_engine.query("Summarize this in detail")
for text in response.response_gen:
    print(text, end="", flush=True)
```

## Advanced retrieval patterns

### HyDE (Hypothetical Document Embeddings)

For vague/short queries, generate a hypothetical answer first, then embed *that* for
retrieval (hypothetical answers tend to be semantically closer to real documents than
short questions are).

```python
from llama_index.core.indices.query.query_transform import HyDEQueryTransform
from llama_index.core.query_engine import TransformQueryEngine

hyde = HyDEQueryTransform(include_original=True)
hyde_query_engine = TransformQueryEngine(query_engine, query_transform=hyde)
response = hyde_query_engine.query("ramifications of this clause")
```

### Sub-question query engine — decompose complex queries

For questions that span multiple documents/sources, break into sub-questions, answer each,
then synthesize.

```python
from llama_index.core.query_engine import SubQuestionQueryEngine
from llama_index.core.tools import QueryEngineTool, ToolMetadata

query_engine_tools = [
    QueryEngineTool(query_engine=sales_engine, metadata=ToolMetadata(name="sales", description="Sales data")),
    QueryEngineTool(query_engine=hr_engine, metadata=ToolMetadata(name="hr", description="HR policies")),
]
sub_question_engine = SubQuestionQueryEngine.from_defaults(query_engine_tools=query_engine_tools)
response = sub_question_engine.query("Compare sales headcount growth to HR hiring targets")
```

### Router query engine — pick the right source dynamically

```python
from llama_index.core.query_engine import RouterQueryEngine
from llama_index.core.selectors import LLMSingleSelector

router_query_engine = RouterQueryEngine(
    selector=LLMSingleSelector.from_defaults(),
    query_engine_tools=query_engine_tools,
)
response = router_query_engine.query("What's our refund policy?")  # Auto-routes to the right tool
```

### Recursive retrieval — parent/child node references

Index small chunks for precise search, but reference back to larger parent context.

```python
from llama_index.core.retrievers import RecursiveRetriever

recursive_retriever = RecursiveRetriever(
    "vector",
    retriever_dict={"vector": vector_retriever},
    node_dict=node_dict,    # mapping of node_id -> parent Node objects
)
```

### Auto-retrieval — LLM-generated structured filters

The LLM reads the query and infers metadata filters automatically (e.g., "shows from 2023"
→ `year=2023` filter), then performs filtered vector search. See vector-store-specific
examples in `vector_databases.md` (e.g., `ChromaAutoRetriever`, Pinecone/Weaviate equivalents).

### Corrective RAG

After retrieval, an evaluation step checks if retrieved docs are sufficient; if not,
fall back to a web search tool before generating the answer. Typically implemented as a
`Workflow` (see `workflows.md`) since it needs conditional branching.

## Structured Outputs from query results

```python
from pydantic import BaseModel
from llama_index.core.program import LLMTextCompletionProgram

class Invoice(BaseModel):
    vendor: str
    total: float
    due_date: str

program = LLMTextCompletionProgram.from_defaults(
    output_cls=Invoice,
    prompt_template_str="Extract invoice details from: {document_text}",
)
invoice = program(document_text=raw_text)
```

For agent/LLM-level structured output (not tied to a query engine), see `agents.md`
"Using Structured Output".