# Atlas Search, Vector Search & AI/RAG Use Cases

## Atlas Search — full-text search

Built on Apache Lucene, integrated directly into your MongoDB cluster (no separate
search infrastructure to run/sync). Available even on the M0 free tier with
limitations.

```js
db.movies.aggregate([
  {
    $search: {
      index: "default",
      text: { query: "space adventure", path: "plot" },
    },
  },
  { $limit: 10 },
])
```

Supports fuzzy matching, autocomplete, faceting, highlighting, and relevance tuning —
far more capable than a basic `$text` index for user-facing search experiences.

## Vector Search — semantic/AI search

**Atlas Vector Search** (and as of MongoDB 8.0, vector search indexes in Community
Edition too) lets you store embedding vectors alongside your operational data and
perform similarity search — the retrieval backbone of RAG (Retrieval-Augmented
Generation) applications.

### Creating a vector search index

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "category" }
  ]
}
```

### Querying with `$vectorSearch`

```js
db.articles.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [0.02, -0.15, ...],   // Your query embedding (e.g., from OpenAI/Voyage)
      numCandidates: 150,
      limit: 10,
      filter: { category: "finance" },   // Optional pre-filter
    },
  },
  { $project: { title: 1, content: 1, score: { $meta: "vectorSearchScore" } } },
])
```

### A minimal RAG pattern with MongoDB as the vector store

```js
// 1. Embed and store documents (once, at ingestion time)
const embedding = await getEmbedding(documentText);  // via OpenAI, Voyage AI, etc.
await db.collection("articles").insertOne({
  title: "...", content: documentText, embedding,
});

// 2. At query time: embed the user's question, then vector search
const queryEmbedding = await getEmbedding(userQuestion);
const results = await db.collection("articles").aggregate([
  { $vectorSearch: { index: "vector_index", path: "embedding", queryVector: queryEmbedding, numCandidates: 150, limit: 5 } },
]).toArray();

// 3. Feed results as context to your LLM call
const context = results.map(r => r.content).join("\n\n");
```

### Automated Embedding (public preview)

Rather than generating embeddings in application code and storing them manually,
Atlas can be configured to automatically generate and maintain embeddings using a
configured model provider (initially Voyage AI models — MongoDB acquired Voyage AI in
2025). This eliminates the "dual-write problem" of keeping embeddings in sync with
source text — a significant simplification for RAG pipelines.

## MongoDB + AI framework integrations

MongoDB (via Atlas Vector Search) is a supported vector store backend in the major
RAG/agent frameworks:

```python
# LangChain
from langchain_mongodb import MongoDBAtlasVectorSearch
from pymongo import MongoClient

client = MongoClient(MONGODB_URI)
collection = client["myapp"]["articles"]

vector_store = MongoDBAtlasVectorSearch(
    collection=collection,
    embedding=embeddings,
    index_name="vector_index",
)
```

```python
# LlamaIndex
from llama_index.vector_stores.mongodb import MongoDBAtlasVectorSearch

vector_store = MongoDBAtlasVectorSearch(
    mongodb_client=client,
    db_name="myapp",
    collection_name="articles",
    vector_index_name="vector_index",
)
```

This is a natural fit if you're already using MongoDB as your operational database —
your RAG vector store and your application data can live in the same cluster, avoiding
a separate dedicated vector database.

## Geospatial search (a third specialized search type)

```js
db.places.createIndex({ location: "2dsphere" })

db.places.find({
  location: { $near: { $geometry: { type: "Point", coordinates: [-73.9857, 40.7484] }, $maxDistance: 5000 } }
})
```

Useful for "find nearby" features — restaurants, stores, delivery zones — using the
same aggregation/query interface as everything else in MongoDB.

## When to reach for each search type

| Need | Use |
|---|---|
| Exact/range filtering on structured fields | Regular indexes + `find()`/`$match` |
| Keyword/full-text relevance ranking | Atlas Search (`$search`) |
| Semantic similarity, RAG retrieval, "find similar" | Atlas/Community Vector Search (`$vectorSearch`) |
| Location-based queries | Geospatial (`2dsphere`) indexes |

They compose — a single aggregation pipeline can combine a `$vectorSearch` stage with
a `filter` on structured metadata fields, or blend text and vector relevance scores for
hybrid search.