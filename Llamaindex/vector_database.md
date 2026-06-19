# Vector Databases — ChromaDB, Pinecone, Qdrant, Weaviate, FAISS, pgvector & More

## Why use an external vector database?

By default LlamaIndex stores embeddings **in memory only** — they disappear on restart.
A real vector DB gives you:
- **Persistence** across restarts
- **Scale** — millions of vectors without RAM constraints
- **Metadata filtering** — filter results by date, category, user, etc. before vector search
- **Hybrid search** — combine semantic + keyword (BM25) search
- **Multi-tenancy** — separate namespaces/collections per user/tenant

All vector stores in LlamaIndex follow the same interface:
1. Create a `VectorStore` object pointing at the DB
2. Create a `StorageContext` wrapping it
3. Build or load a `VectorStoreIndex` using that context

---

## ChromaDB — local-first, great for dev + production

```bash
pip install llama-index-vector-stores-chroma chromadb
```

### Ephemeral (in-memory, dev only)
```python
import chromadb
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.core import StorageContext, VectorStoreIndex

chroma_client = chromadb.EphemeralClient()
chroma_collection = chroma_client.create_collection("my_docs")

vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)
index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)
```

### Persistent (survives restarts)
```python
chroma_client = chromadb.PersistentClient(path="./chroma_db")
chroma_collection = chroma_client.get_or_create_collection("my_docs")

vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

# Build index (first time)
index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# Reconnect to existing index (subsequent runs)
index = VectorStoreIndex.from_vector_store(vector_store)
```

### ChromaDB with metadata filtering
```python
from llama_index.core.vector_stores import MetadataFilter, MetadataFilters, FilterOperator

filters = MetadataFilters(filters=[
    MetadataFilter(key="category", value="finance"),
    MetadataFilter(key="year", value=2024, operator=FilterOperator.GTE),
])
query_engine = index.as_query_engine(filters=filters, similarity_top_k=5)
response = query_engine.query("What are the key financial risks?")
```

### Auto-retrieval with Chroma (LLM generates filters)
```python
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.retrievers.chroma import ChromaAutoRetriever
from llama_index.core.vector_stores.types import VectorStoreInfo, MetadataInfo

vector_store_info = VectorStoreInfo(
    content_info="Financial reports from 2020-2024",
    metadata_info=[
        MetadataInfo(name="year", type="int", description="Publication year"),
        MetadataInfo(name="category", type="str", description="Report category"),
    ],
)
retriever = ChromaAutoRetriever(
    index,
    vector_store_info=vector_store_info,
    similarity_top_k=5,
)
```

ChromaDB docs: `docs.trychroma.com`

---

## Pinecone — managed cloud, production-grade at scale

```bash
pip install llama-index-vector-stores-pinecone pinecone-client
```

```python
from pinecone import Pinecone, ServerlessSpec
from llama_index.vector_stores.pinecone import PineconeVectorStore
from llama_index.core import StorageContext, VectorStoreIndex

# Create index in Pinecone (once)
pc = Pinecone(api_key="pc-...")
pc.create_index(
    name="my-rag-index",
    dimension=1536,          # Match your embedding model dims
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1")
)

# Connect
pinecone_index = pc.Index("my-rag-index")
vector_store = PineconeVectorStore(pinecone_index=pinecone_index)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

# Build
index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# Reconnect (vectors already in Pinecone)
index = VectorStoreIndex.from_vector_store(vector_store)
```

### Pinecone namespaces (for multi-tenancy)
```python
vector_store = PineconeVectorStore(
    pinecone_index=pinecone_index,
    namespace="user_123"     # Isolate data per user/tenant
)
```

### Pinecone hybrid search (dense + sparse)
```python
# pip install llama-index-vector-stores-pinecone[hybrid]
from llama_index.vector_stores.pinecone import PineconeVectorStore

vector_store = PineconeVectorStore(
    pinecone_index=pinecone_index,
    add_sparse_vector=True,        # Enables BM25 sparse vectors
)
retriever = index.as_retriever(
    vector_store_query_mode="hybrid",
    alpha=0.5,                     # 0=pure BM25, 1=pure semantic
    similarity_top_k=5,
)
```

---

## Qdrant — self-hosted or cloud, excellent hybrid search

```bash
pip install llama-index-vector-stores-qdrant qdrant-client
```

```python
from qdrant_client import QdrantClient
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core import StorageContext, VectorStoreIndex

# Local persistent
client = QdrantClient(path="./qdrant_storage")
# Cloud
client = QdrantClient(url="https://xxx.qdrant.io:6333", api_key="your-api-key")

vector_store = QdrantVectorStore(client=client, collection_name="my_docs")
storage_context = StorageContext.from_defaults(vector_store=vector_store)

index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)
```

### Qdrant hybrid search (dense + BM42 sparse)
```python
vector_store = QdrantVectorStore(
    client=client,
    collection_name="hybrid_docs",
    enable_hybrid=True,            # Enables BM25/BM42 sparse vectors
    fastembed_sparse_model="Qdrant/bm42-all-minilm-l6-v2-attentions",
)

retriever = index.as_retriever(
    vector_store_query_mode="hybrid",
    similarity_top_k=5,
)
```

Qdrant docs: `qdrant.tech/documentation`

---

## Weaviate — schema-based, excellent GraphQL

```bash
pip install llama-index-vector-stores-weaviate weaviate-client
```

```python
import weaviate
from llama_index.vector_stores.weaviate import WeaviateVectorStore
from llama_index.core import StorageContext, VectorStoreIndex

client = weaviate.connect_to_local()   # or weaviate.connect_to_wcs()
vector_store = WeaviateVectorStore(weaviate_client=client, index_name="LlamaIndex")
storage_context = StorageContext.from_defaults(vector_store=vector_store)

index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)
```

### Weaviate hybrid search
```python
retriever = index.as_retriever(
    vector_store_query_mode="hybrid",
    alpha=0.5,
    similarity_top_k=5,
)
```

---

## FAISS — fast local, open source (Meta)

Best for millions of vectors on a single machine with no cloud dependency.

```bash
pip install llama-index-vector-stores-faiss faiss-cpu
# or: faiss-gpu for GPU acceleration
```

```python
import faiss
from llama_index.vector_stores.faiss import FaissVectorStore
from llama_index.core import StorageContext, VectorStoreIndex

faiss_index = faiss.IndexFlatL2(1536)   # 1536 = OpenAI embedding dims (match your model)
vector_store = FaissVectorStore(faiss_index=faiss_index)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# Persist FAISS to disk
index.storage_context.persist(persist_dir="./faiss_storage")

# Reload
vector_store = FaissVectorStore.from_persist_dir("./faiss_storage")
storage_context = StorageContext.from_defaults(vector_store=vector_store, persist_dir="./faiss_storage")
index = load_index_from_storage(storage_context)
```

Note: FAISS doesn't support metadata filtering natively — use `VectorIndexRetriever`
with a custom `node_postprocessor` if you need filtering.

---

## PostgreSQL / pgvector — SQL database + vector search

Best when you're already on Postgres and want to avoid introducing another DB.

```bash
pip install llama-index-vector-stores-postgres psycopg2-binary
```

```python
from llama_index.vector_stores.postgres import PGVectorStore
from sqlalchemy import make_url

connection_string = "postgresql+psycopg2://user:password@localhost:5432/mydb"
url = make_url(connection_string)

vector_store = PGVectorStore.from_params(
    database=url.database,
    host=url.host,
    password=url.password,
    port=url.port,
    user=url.username,
    table_name="document_embeddings",
    embed_dim=1536,                         # Match your embedding model
    hybrid_search=True,                     # Enables tsvector BM25
    text_search_config="english",
)

storage_context = StorageContext.from_defaults(vector_store=vector_store)
index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)
```

---

## Vector store selection guide

| Store | Best for | Hosting |
|---|---|---|
| **ChromaDB** | Dev + small-medium production, ease of use | Local / self-hosted |
| **Pinecone** | Large scale managed cloud, multi-tenancy via namespaces | Cloud |
| **Qdrant** | Production self-hosted, best-in-class hybrid search | Local / cloud |
| **Weaviate** | Schema-driven apps, GraphQL queries | Local / cloud |
| **FAISS** | Single-machine high throughput, no external dependency | Local |
| **pgvector** | Already on Postgres, no extra infra | Postgres DB |
| **Milvus** | Very large scale, distributed | Local / cloud |
| **MongoDB Atlas** | Already on Mongo | Cloud |

## Hybrid search — when to use it

Combine semantic (dense) + keyword (sparse/BM25) for better recall:
- Pure semantic may miss exact terminology, codes, proper names
- Pure keyword misses paraphrases, synonyms, conceptual similarity
- Hybrid covers both; alpha parameter controls the balance (0=pure keyword, 1=pure semantic)
- Supported natively by Pinecone, Qdrant, Weaviate, Elasticsearch, pgvector