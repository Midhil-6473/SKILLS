# Indexing & Embeddings

## What an Index is

An Index is a data structure built from Documents/Nodes that enables efficient querying by
an LLM. It nearly always involves embedding each node's text into a vector and storing those
vectors for similarity retrieval.

## Index types — complete reference

### VectorStoreIndex (use this by default)

The overwhelmingly most common index type. Embeds every node, stores vectors, enables
top-k semantic similarity retrieval.

```python
from llama_index.core import VectorStoreIndex

# From documents (auto-splits into nodes, embeds, stores in memory)
index = VectorStoreIndex.from_documents(documents, show_progress=True)

# From pre-created nodes
index = VectorStoreIndex(nodes)

# With a persistent external vector store (Chroma, Pinecone, etc.)
index = VectorStoreIndex.from_documents(
    documents,
    storage_context=storage_context,
    show_progress=True
)
```

Batch size for embedding (default 2048, tune for memory/rate limits):
```python
index = VectorStoreIndex.from_documents(documents, insert_batch_size=512)
```

### SummaryIndex (formerly ListIndex)

Stores all documents and returns **all** of them to the LLM for summarization queries.
Best for "summarize this document" tasks, not for precise Q&A.

```python
from llama_index.core import SummaryIndex

index = SummaryIndex.from_documents(documents)
query_engine = index.as_query_engine(response_mode="tree_summarize")
response = query_engine.query("Summarize the key points")
```

### KeywordTableIndex

Builds a keyword→node lookup table. Lower quality than VectorStoreIndex for most tasks,
but no embedding API calls needed (free/local).

```python
from llama_index.core import KeywordTableIndex
index = KeywordTableIndex.from_documents(documents)
```

### PropertyGraphIndex (Knowledge Graph)

Extracts entities and relationships from text, builds a graph, and supports
graph-based retrieval. Best for questions requiring multi-hop reasoning.

```python
from llama_index.core import PropertyGraphIndex

index = PropertyGraphIndex.from_documents(
    documents,
    show_progress=True,
)
query_engine = index.as_query_engine(include_text=True)
```

Integrates with Neo4j, Nebula, and other graph stores for persistence. See
`developers.llamaindex.ai/python/framework/module_guides/indexing/lpg_index_guide/`

### Which index to pick?

| Scenario | Index |
|---|---|
| Precise Q&A over documents | `VectorStoreIndex` |
| Full document summarization | `SummaryIndex` |
| No embedding budget / keyword search | `KeywordTableIndex` |
| Multi-hop / relational queries | `PropertyGraphIndex` |
| Hybrid: precise + parent context | `VectorStoreIndex` + `HierarchicalNodeParser` |

## Embeddings — deep dive

An **embedding** is a fixed-size float vector representing the semantic meaning of text.
Similar meaning → similar vectors → small cosine distance. This is the engine of semantic
search in RAG.

### Configuring embedding models globally

```python
from llama_index.core import Settings

# OpenAI (high quality, costs money)
from llama_index.embeddings.openai import OpenAIEmbedding
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")  # 1536 dims, fast+cheap
# or: model="text-embedding-3-large"  # 3072 dims, best quality

# Anthropic / Google
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
Settings.embed_model = GoogleGenAIEmbedding(model_name="models/gemini-embedding-001")

# Free local (HuggingFace)
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
Settings.embed_model = HuggingFaceEmbedding(
    model_name="BAAI/bge-small-en-v1.5"  # 384 dims, fast, free
)

# Ollama local (run ollama pull nomic-embed-text first)
from llama_index.embeddings.ollama import OllamaEmbedding
Settings.embed_model = OllamaEmbedding(model_name="nomic-embed-text")

# Cohere
from llama_index.embeddings.cohereai import CohereEmbedding
Settings.embed_model = CohereEmbedding(
    cohere_api_key="...",
    model_name="embed-english-v3.0",
    input_type="search_document"   # use "search_query" for queries
)
```

### Embedding model selection guide

| Model | Dims | Best for |
|---|---|---|
| `text-embedding-3-small` (OpenAI) | 1536 | Best cost/quality balance for English |
| `text-embedding-3-large` (OpenAI) | 3072 | Highest quality, expensive |
| `BAAI/bge-small-en-v1.5` (HF) | 384 | Free, fast, good for English |
| `BAAI/bge-large-en-v1.5` (HF) | 1024 | Free, better quality |
| `nomic-embed-text` (Ollama) | 768 | Free local, excellent for RAG |
| `embed-english-v3.0` (Cohere) | 1024 | Enterprise-grade, good multilingual |
| `voyage-3` (VoyageAI) | 1024 | State of the art retrieval benchmark |

**Critical rule:** Always use the **same embedding model** for both indexing and querying.
If you index with model A, you must query with model A. Mixing models produces nonsensical
similarity scores.

### Using LangChain embeddings inside LlamaIndex

```python
from langchain_openai import OpenAIEmbeddings
from llama_index.embeddings.langchain import LangchainEmbedding

lc_embed = OpenAIEmbeddings(model="text-embedding-ada-002")
Settings.embed_model = LangchainEmbedding(lc_embed)
```

Any LangChain embedding can be used inside LlamaIndex this way.

## Document management — updating the index

```python
# Refresh existing documents (re-index if content changed)
refreshed_docs = index.refresh_ref_docs(
    documents,
    update_kwargs={"delete_kwargs": {"delete_from_docstore": True}}
)
print(f"Refreshed: {sum(refreshed_docs)}/{len(refreshed_docs)} documents")

# Insert new documents into existing index
for doc in new_documents:
    index.insert(doc)

# Delete by doc_id
index.delete_ref_doc("doc_id_to_remove", delete_from_docstore=True)
```

## Persisting and loading indexes

```python
from llama_index.core import StorageContext, load_index_from_storage

# Save to local disk
index.storage_context.persist(persist_dir="./my_index_storage")

# Load back (must pass same embed_model in Settings first!)
storage_context = StorageContext.from_defaults(persist_dir="./my_index_storage")
index = load_index_from_storage(storage_context)
```

For external vector stores (Chroma, Pinecone, etc.), the vectors already live in the
database — you just reconnect to the store and recreate the index wrapper.