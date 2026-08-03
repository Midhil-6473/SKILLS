# MongoDB Fundamentals — Databases, Documents, Collections, BSON

## What is a database? (starting from zero)

A database is software that stores data durably and lets applications query it
reliably, efficiently, and concurrently. Without one, an app would have to manage raw
files — reinventing indexing, concurrent access, crash recovery, and query logic from
scratch. A database provides all of that as a service.

**Two big database families:**

- **Relational (SQL)** — MySQL, PostgreSQL, SQL Server. Data lives in tables with fixed
  columns; relationships are expressed via foreign keys and joined with `JOIN`.
- **Document (NoSQL)** — MongoDB. Data lives as flexible, JSON-like documents in
  collections; relationships are expressed by embedding related data directly or by
  referencing another document's `_id`.

Other NoSQL categories exist (key-value like Redis, wide-column like Cassandra, graph
like Neo4j) — MongoDB is specifically a **document database**.

## What is MongoDB?

MongoDB is a document database designed to help developers build modern applications
faster. It stores data in flexible, JSON-like documents, making it easy to model data
the same way your application code uses it. The flexible schema lets you evolve your
data model without downtime, iterate quickly, and easily handle non-uniform data.

MongoDB is a fully-transactional operational database supporting a wide range of
workloads: document-based structured search (OLTP), data aggregation, full-text search,
vector search, geospatial search, and time series.

## The four architectural pillars

1. **Document Database** — the flexible document data model lets you map your data to
   your application's needs.
2. **Transactions** — multi-document ACID transactions allow complex operations that
   require data consistency, including across sharded clusters.
3. **High Availability** — replication and automatic failover ensure your data is
   always available; if a primary becomes unavailable, the cluster automatically elects
   a new primary.
4. **Horizontal Scaling** — sharding enables horizontal scaling to handle large
   datasets and high throughput, automatically partitioning data across a cluster.

## Documents — the basic unit of storage

A record in MongoDB is a **document** — a data structure composed of field/value
pairs, similar to a JSON object. Field values can be strings, numbers, dates, booleans,
arrays, or even other embedded documents.

```json
{
  "_id": "ObjectId('507f1f77bcf86cd799439011')",
  "name": "Alice",
  "birthdate": "1990-01-01T00:00:00Z",
  "address": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL"
  },
  "hobbies": ["reading", "hiking", "coding"]
}
```

Advantages of this model:
- Documents correspond to native data types in most programming languages (JS objects,
  Python dicts) — no complex object-relational mapping needed.
- Embedded documents and arrays reduce the need for expensive joins that slow down
  relational systems.
- Dynamic schemas support **polymorphism** — documents in the same collection can have
  varied structures (e.g., some products have a `size` field, others don't).

## BSON — what documents are actually stored as

MongoDB stores documents as **BSON** (Binary JSON) — a binary-encoded superset of JSON
that adds types JSON lacks: `Date`, `ObjectId`, `Binary data`, `Decimal128`, `int32`,
`int64`, and more. This is why a MongoDB document can hold a real `Date` object rather
than a string representation of one.

## Databases and Collections

- A **MongoDB deployment** hosts a number of independent **databases**.
- Each database holds a set of **collections** — MongoDB's equivalent of relational
  tables, but without a rigid, pre-defined schema enforced by default.
- MongoDB also supports **views** — read-only, computed collections defined by an
  aggregation pipeline over an underlying collection.

```js
use myDatabase                       // Switch to (or implicitly create) a database
db.createCollection("myCollection")  // Explicitly create a collection (optional — MongoDB
                                      // auto-creates collections on first insert)
```

## The `_id` field

Every document has a unique `_id` field acting as its primary key within the
collection. If you don't supply one, MongoDB auto-generates an `ObjectId` — a
12-byte identifier encoding a timestamp, a random value, and a counter, making it
roughly sortable by creation time and globally unique without coordination.

## Client libraries (drivers)

MongoDB provides official drivers for essentially every major language: Node.js,
Python (PyMongo), Java, C#/.NET, Go, Rust, PHP, Ruby, C, C++, Kotlin, Swift. All follow
similar conventions for connecting, running CRUD operations, and aggregation. See
`mongodb.com/docs/drivers/` for the full list.

`mongosh` (the MongoDB Shell) is the official interactive JavaScript-based shell/CLI
for connecting to and administering any MongoDB deployment — local or Atlas.

```bash
# Connect with mongosh (works against local MongoDB or Atlas)
mongosh "mongodb://localhost:27017"
mongosh "mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/"
```

## MongoDB Compass — the GUI

**Compass** is MongoDB's official desktop GUI for browsing collections, running
queries visually, building aggregation pipelines with a stage-by-stage preview, and
analyzing schema/index performance — without writing shell commands. Recommended for
beginners exploring data, and useful even for experienced engineers debugging queries.

## When to choose MongoDB vs. a relational database

**Choose MongoDB when:**
- Your data has a natural hierarchical/nested shape (user profile with embedded
  addresses, a product with variable attributes)
- Your schema will evolve frequently and you don't want migrations blocking releases
- You need to scale horizontally across many servers
- Read patterns dominate and can be served by a single document fetch (no joins)
- You're building AI/RAG applications needing vector search alongside operational data

**Choose a relational database when:**
- Your data is inherently tabular with many-to-many relationships that change shape
  over time (e.g., complex financial ledgers with strict referential integrity)
- You need heavy ad-hoc JOIN-based reporting across many normalized tables
- Strict foreign-key constraint enforcement at the DB level is a hard requirement

In practice, most modern web/mobile apps map cleanly to MongoDB's document model, which
is why it anchors the "M" in the MEAN/MERN stack (MongoDB, Express, Angular/React, Node).