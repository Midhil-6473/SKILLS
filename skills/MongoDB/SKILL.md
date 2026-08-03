---
name: mongodb-architect
description: >
  Complete architect's manual for MongoDB, the leading document/NoSQL database, and
  MongoDB Atlas, its managed cloud platform. Use whenever the user asks about MongoDB,
  databases in general (what a database is, SQL vs NoSQL, when to use a document
  database), Atlas (account creation, organizations, projects, clusters, free tier M0),
  schemas and data modeling, Mongoose (schemas, models, validation, middleware,
  population), the Node.js/Python/other drivers, CRUD operations, aggregation
  pipelines, indexes, replication, sharding, transactions, Compass, or integrating
  MongoDB with backend frameworks such as Node.js, Express, Next.js, Django, Flask,
  FastAPI, or Spring Boot. Also trigger for beginner questions about what a database
  is, what NoSQL means, how to design a schema, how to connect an app to MongoDB, or
  MongoDB Vector Search / Atlas Search for AI applications.
---

# The MongoDB Architect's Manual

You are acting as an expert MongoDB architect and backend engineer. This skill covers
MongoDB from "what is a database" through production Atlas deployments and full-stack
framework integration.

**Docs home:** `mongodb.com/docs/manual/` (server) and `mongodb.com/docs/atlas/` (Atlas)
**Machine-readable docs index:** `mongodb.com/docs/llms.txt` (append `.md` to any docs URL
for a markdown version)

## What is a database, and where does MongoDB fit?

A **database** is organized, persistent storage for data that an application reads and
writes, with guarantees around durability, consistency, and query performance that a
plain file can't offer.

Two broad families:

| | Relational (SQL) | Document (NoSQL) — MongoDB |
|---|---|---|
| Unit of storage | Row in a rigid-schema table | Document (JSON/BSON-like) in a collection |
| Schema | Fixed upfront, enforced by the DB | Flexible; can evolve without downtime |
| Relationships | Foreign keys + JOINs | Embedding (nest data) or referencing (manual join via `$lookup`) |
| Best for | Highly structured, relationship-heavy data (banking ledgers) | Evolving, hierarchical, or non-uniform data (user profiles, catalogs, content) |

MongoDB stores data as **documents** — field/value pairs similar to JSON, actually stored
as BSON (binary JSON with extra types like dates and binary data). Documents live in
**collections** (loosely analogous to tables, but without a rigid enforced schema).

```json
{
  "_id": "ObjectId('507f1f77bcf86cd799439011')",
  "name": "Alice",
  "birthdate": "1990-01-01T00:00:00Z",
  "address": { "street": "123 Main St", "city": "Springfield", "state": "IL" },
  "hobbies": ["reading", "hiking", "coding"]
}
```

**Why this matters practically:** the document model mirrors how objects look in your
application code (a JS object, a Python dict) — no complex object-relational mapping,
embedded documents/arrays avoid expensive joins for common access patterns, and dynamic
schemas support documents with different shapes in the same collection.

## Where MongoDB is used

- Content management, catalogs, user profiles — anything with evolving/nested shape
- Real-time analytics and dashboards (aggregation pipeline)
- IoT and event/time-series data
- Mobile and web app backends (the classic MEAN/MERN stack: MongoDB-Express-Angular/React-Node)
- Full-text and vector/semantic search (Atlas Search, Atlas Vector Search)
- Applications needing horizontal scale (sharding) beyond a single server

## Core architecture (know these four before anything else)

1. **Document database** — flexible schema, native fit for app object models
2. **Transactions** — multi-document ACID transactions, including across sharded clusters
3. **High availability** — replica sets give automatic failover and read scaling
4. **Horizontal scaling** — sharding partitions data across many machines by a shard key

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Databases 101, documents, collections, BSON, when to use MongoDB vs SQL | `references/fundamentals.md` |
| CRUD operations (insert/find/update/delete), query operators | `references/crud_operations.md` |
| Data modeling: schema design patterns, embedding vs referencing, relationships | `references/data_modeling.md` |
| Indexes: types, compound indexes, ESR rule, performance | `references/indexes.md` |
| Aggregation pipeline: stages, $match/$group/$lookup, optimization | `references/aggregation.md` |
| Mongoose ODM: schemas, SchemaTypes, models, validation, middleware, populate | `references/mongoose.md` |
| MongoDB Atlas: account creation, orgs/projects, clusters, network access, connection strings | `references/atlas_setup.md` |
| Node.js/Express/Next.js integration, other backend frameworks (Django, Flask, FastAPI, Spring Boot) | `references/backend_integrations.md` |
| Transactions, replication, sharding, production operations | `references/scaling_and_production.md` |
| Vector Search, Atlas Search, AI/RAG use cases | `references/search_and_ai.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Model for your access patterns, not for normalization.** Unlike SQL, the right
   MongoDB schema depends on how your app *reads* and *writes* data, not on eliminating
   redundancy. "It depends on your queries" is the correct default answer to "should I
   embed or reference?" — see `data_modeling.md`.
2. **Always use environment variables for connection strings/credentials** — never
   hardcode Atlas connection strings in source.
3. **`$match` early, `$project` late** in aggregation pipelines — filter before you
   transform, project fields only at the end unless it demonstrably reduces payload for
   a `$lookup`.
4. **Index what you query and sort by**, using the ESR rule (Equality, Sort, Range)
   for compound indexes — see `indexes.md`.
5. **Use Mongoose (or an ODM) in Node.js apps** unless you have a specific reason not
   to — schema validation, middleware, and population save enormous boilerplate versus
   the raw driver.
6. **Never allow `0.0.0.0/0` (open to all IPs) in Atlas Network Access for production** —
   restrict to known IPs or use VPC/PrivateLink peering.
7. **Default to the free M0 tier while learning**, upgrade to M10+ only when you need
   dedicated resources, backups, or production SLAs.
8. **Source of truth:** `mongodb.com/docs`. If the user's question involves a very
   recent driver version or feature, web-search the official docs rather than guessing —
   MongoDB ships new major versions (8.0 etc.) with real behavioral changes.