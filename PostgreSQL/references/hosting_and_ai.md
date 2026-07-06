# Managed PostgreSQL Platforms & AI/Vector Search

## Why use a managed platform?

Running PostgreSQL yourself means handling provisioning, patching, backups, high
availability, and scaling manually. Managed platforms handle this operational burden —
analogous to how MongoDB Atlas relates to self-managed MongoDB.

## Supabase — "Firebase alternative," built on Postgres

Supabase wraps a real PostgreSQL database with an auto-generated REST/GraphQL API,
authentication, storage, realtime subscriptions, and edge functions.

**Getting started:**
1. Sign up at `supabase.com`, create a new project (this provisions a dedicated
   Postgres instance).
2. Design tables via the Table Editor UI or plain SQL in the SQL Editor.
3. Supabase auto-generates a REST API (PostgREST) and client libraries for every table.

```js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const { data, error } = await supabase.from("users").select("*").eq("active", true);
await supabase.from("orders").insert({ user_id: 1, amount: 100 });
```

**Row-Level Security (RLS) is central to Supabase's security model** — since the
auto-generated API is directly exposed to the client, RLS policies (see
`roles_and_security.md`) are what actually enforces per-row access control instead of
an application server mediating every request.

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);
```

Supabase also bundles `pgvector` as a first-class extension for AI/RAG applications.

## Neon — serverless Postgres with branching

Neon separates storage and compute, enabling:
- **Instant database branching** — create a full copy-on-write branch of your database
  for a feature branch or PR, the same way you'd branch code in git.
- **Scale-to-zero** — compute automatically suspends when idle, ideal for dev/preview
  environments, and resumes on the next connection.
- **Serverless driver** — a WebSocket/HTTP-based driver (`@neondatabase/serverless`)
  designed for edge/serverless runtimes where traditional TCP connections are awkward.

```bash
npm install @neondatabase/serverless
```

```js
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const users = await sql`SELECT * FROM users WHERE active = true`;
```

**When to reach for Neon specifically:** ephemeral preview environments per pull
request, or edge/serverless runtimes (Cloudflare Workers, Vercel Edge Functions) where
a standard `pg` TCP connection pool doesn't fit the execution model.

## Amazon RDS for PostgreSQL

AWS's managed relational database service. Key characteristics:
- Automated backups, patching, and **Multi-AZ deployments** for high availability
  (synchronous standby in a different Availability Zone with automatic failover).
- **Read replicas** for read scaling, using PostgreSQL's native streaming replication
  under the hood.
- Vertical scaling (instance class) and storage auto-scaling.
- Integrates with the broader AWS ecosystem (IAM database authentication, VPC
  networking, CloudWatch monitoring, Secrets Manager for credentials).

```bash
# Typical connection (via a standard driver — RDS is wire-compatible Postgres)
psql "host=mydb.xxxxxxx.us-east-1.rds.amazonaws.com port=5432 dbname=mydb user=myuser sslmode=require"
```

**When to choose RDS:** teams already standardized on AWS infrastructure, needing
tight IAM/VPC integration, or requiring specific AWS compliance certifications.
**Aurora PostgreSQL** (AWS's proprietary storage-layer variant) is a related option
offering higher throughput/availability at a different price point, wire-compatible
with standard PostgreSQL clients.

## Google Cloud SQL for PostgreSQL

Google Cloud's equivalent managed offering — automated backups, high availability,
read replicas, and increasingly, built-in AI features (natural-language query
assistance, automated performance investigations) as these platforms converge toward
AI-assisted database operations.

## Choosing a platform

| Platform | Best for |
|---|---|
| **Supabase** | Full-stack apps wanting an instant REST/GraphQL API + auth + storage on top of Postgres, RLS-driven security |
| **Neon** | Branchable databases for CI/preview environments, serverless/edge runtimes, scale-to-zero dev workloads |
| **Amazon RDS / Aurora** | Teams on AWS needing deep IAM/VPC integration and enterprise support |
| **Google Cloud SQL** | Teams on GCP, increasingly AI-assisted operations |
| **Self-managed** | Full control, specific compliance/data-residency requirements, or cost optimization at very large scale |

## `pgvector` — vector search for AI/RAG applications

PostgreSQL's `pgvector` extension adds a native vector data type and similarity search
operators — letting you store embeddings alongside your normal relational data instead
of running a separate dedicated vector database.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE articles (
    id INTEGER PRIMARY KEY,
    title TEXT,
    content TEXT,
    embedding VECTOR(1536)   -- dimension must match your embedding model
);

-- Similarity search using cosine distance
SELECT title, 1 - (embedding <=> '[0.01, -0.02, ...]') AS similarity
FROM articles
ORDER BY embedding <=> '[0.01, -0.02, ...]'
LIMIT 5;
```

| Operator | Distance metric |
|---|---|
| `<->` | Euclidean (L2) distance |
| `<=>` | Cosine distance |
| `<#>` | Negative inner product |

### Indexing vectors for performance

```sql
-- IVFFlat: faster to build, good for moderate scale
CREATE INDEX ON articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- HNSW: better query performance and recall, more popular for production RAG (pgvector 0.5.0+)
CREATE INDEX ON articles USING hnsw (embedding vector_cosine_ops);
```

**HNSW is generally the recommended default** for production RAG workloads — better
query-time performance than IVFFlat at the cost of somewhat slower index builds.

### A minimal RAG pattern with pgvector

```python
# 1. Store: embed and insert
embedding = get_embedding(document_text)  # via OpenAI, Voyage AI, etc.
cursor.execute(
    "INSERT INTO articles (title, content, embedding) VALUES (%s, %s, %s)",
    (title, document_text, embedding)
)

# 2. Query: embed the question, find nearest neighbors
query_embedding = get_embedding(user_question)
cursor.execute(
    "SELECT content FROM articles ORDER BY embedding <=> %s LIMIT 5",
    (query_embedding,)
)
context = "\n\n".join(row[0] for row in cursor.fetchall())
```

### PostgreSQL + AI framework integrations

```python
# LangChain
from langchain_postgres import PGVector

vector_store = PGVector(
    embeddings=embeddings,
    collection_name="articles",
    connection=os.environ["DATABASE_URL"],
)
```

```python
# LlamaIndex
from llama_index.vector_stores.postgres import PGVectorStore

vector_store = PGVectorStore.from_params(
    database="mydb", host="localhost", password="...", port=5432, user="...",
    table_name="articles", embed_dim=1536,
)
```

**Why teams choose pgvector over a dedicated vector database:** if you're already
running PostgreSQL for your operational data, storing embeddings in the same database
avoids operating a second system, and lets you combine relational filters
(`WHERE category = 'finance'`) with vector similarity in a single SQL query — genuinely
convenient for RAG applications that also need structured metadata filtering.

**When a dedicated vector database might still be worth it:** very large-scale vector
search (hundreds of millions+ vectors) where a purpose-built system's specialized
indexing may outperform pgvector, or when vector search is the overwhelming majority
of your workload rather than a feature alongside relational data.