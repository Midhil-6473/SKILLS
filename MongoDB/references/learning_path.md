# Beginner → Advanced Learning Path (MongoDB & Atlas)

Use this as a curriculum when the user wants a structured roadmap rather than a point
answer. Each phase names the reference file(s) to pull detail from.

## Phase 0 — Orientation (15 minutes)

- Understand what a database is and where MongoDB (document/NoSQL) fits vs. relational
  (SQL) databases. See `fundamentals.md`.
- Understand documents, collections, and BSON.
- Decide: local MongoDB install vs. Atlas free tier. **Recommendation: start on Atlas**
  — zero install friction, and it's the same environment you'll use in production.

**Practice:** Create an Atlas account and deploy an M0 free cluster (see `atlas_setup.md`).

## Phase 1 — Atlas Setup & First Connection

*Read: `atlas_setup.md`*

1. Create Atlas account, organization, project.
2. Deploy an M0 free cluster.
3. Create a database user and configure network access (allow your current IP).
4. Copy the connection string, connect via `mongosh`.
5. Install MongoDB Compass and connect via the GUI too.

**Practice project:** Connect via `mongosh`, create a database, insert a few documents,
query them back. Do the same thing in Compass to see the visual equivalent.

## Phase 2 — CRUD Operations

*Read: `crud_operations.md`*

1. Insert one/many documents.
2. Query with filters, projections, sort/limit/skip.
3. Update with `$set`, `$inc`, `$push`; understand upsert.
4. Delete one/many.
5. Try `findOneAndUpdate` for atomic read-modify-write.

**Practice project:** Build a simple "tasks" collection — insert tasks, query by
status, mark tasks complete, delete completed tasks older than a date.

## Phase 3 — Data Modeling

*Read: `data_modeling.md`*

1. Understand embedding vs. referencing — and that the right choice depends on access
   patterns, not normalization theory.
2. Try modeling the same relationship (e.g., users + orders) both ways and reason
   about the trade-offs.
3. Learn 2-3 schema design patterns (subset, computed, bucket) and where they'd help.
4. Try adding a `$jsonSchema` validator to a collection.

**Practice project:** Design a schema for a blogging platform (users, posts, comments).
Justify embedding vs. referencing for each relationship based on realistic access
patterns.

## Phase 4 — Indexes

*Read: `indexes.md`*

1. Create single-field and compound indexes.
2. Learn the ESR rule (Equality, Sort, Range) for compound index field ordering.
3. Use `explain("executionStats")` to confirm `IXSCAN` vs `COLLSCAN`.
4. Try a TTL index (e.g., auto-expiring session documents) and a partial index.

**Practice project:** Take your tasks/blog collection from earlier phases, write 2-3
realistic queries, and add indexes that make them use `IXSCAN` instead of `COLLSCAN`.

## Phase 5 — Aggregation Pipeline

*Read: `aggregation.md`*

1. `$match` → `$group` → `$sort` — the core pipeline shape.
2. `$lookup` for joins across collections.
3. `$project`, `$addFields` for reshaping output.
4. `$facet` for multi-metric dashboard-style queries.
5. Optimize a pipeline: `$match` first, index the `$lookup` foreign field, verify with
   `explain()`.

**Practice project:** Build a small analytics query — e.g., total spend per customer,
joined with customer name, sorted by spend descending, top 10 only.

## Phase 6 — Mongoose (for Node.js developers)

*Read: `mongoose.md`*

1. Define a schema with SchemaTypes, validators, and defaults.
2. Convert to a Model; perform CRUD via the Model API.
3. Add a `pre('save')` hook (e.g., hash a password).
4. Set up a reference relationship and use `.populate()`.
5. Add an instance method, a static method, and a virtual.

**Practice project:** Rebuild your blog schema from Phase 3 in Mongoose, with
validation, a `pre('save')` slug-generation hook, and `.populate()` for the author
reference.

## Phase 7 — Backend Framework Integration

*Read: `backend_integrations.md`*

1. Wire up an Express REST API with Mongoose models and full CRUD routes.
2. Add error-handling middleware for validation errors and duplicate-key errors.
3. If using Next.js: implement the cached-connection pattern for API routes/Server
   Components, and guard against `OverwriteModelError` in dev mode.
4. If using Python: try the FastAPI + Motor async pairing, or Flask + PyMongo for a
   simpler sync API.

**Practice project:** Turn your Phase 6 Mongoose blog models into a working REST API
(Express or FastAPI) with routes for creating, listing, updating, and deleting posts.

## Phase 8 — Transactions, Replication, Sharding

*Read: `scaling_and_production.md`*

1. Understand when transactions are actually necessary (multi-document atomicity) vs.
   when single-document atomicity already suffices.
2. Understand replica sets and automatic failover — know that Atlas provides this by
   default.
3. Understand sharding conceptually and why shard key choice matters — no need to
   actually shard a learning project.
4. Try a change stream to react to inserts in real time.

**Practice project:** Add a transaction to a "transfer between two accounts" scenario
(debit one document, credit another, atomically). Add a change stream listener that
logs new orders as they're inserted.

## Phase 9 — Search & AI (optional, for AI-focused learners)

*Read: `search_and_ai.md`*

1. Try Atlas Search for full-text search on a text-heavy collection.
2. If building an AI/RAG app: create a Vector Search index, store embeddings, and run
   a `$vectorSearch` query.
3. If using LangChain/LlamaIndex: wire up `MongoDBAtlasVectorSearch` as the vector
   store backend.

**Practice project:** Add a Vector Search index to a small article/document
collection and build a minimal RAG query flow (embed question → vector search →
feed results to an LLM).

## Phase 10 — Production Readiness

*Read: `atlas_setup.md` (production checklist) + `scaling_and_production.md`*

1. Review Network Access — ensure no `0.0.0.0/0` in a real deployment.
2. Move connection strings to environment variables/secrets managers.
3. Set up automated backups (M10+).
4. Set up basic monitoring/alerting in Atlas.
5. Run through the official Development Checklist before considering anything
   "production ready."

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer with a
specific production task):
- Go phase by phase, one small concrete project per phase, rather than a wall of docs.
- Default to Atlas M0 (free) for all practice — there's no reason to install MongoDB
  locally for learning purposes.
- Check understanding with a quick build before advancing — e.g., "before we move to
  aggregation, want to try writing 2-3 queries with different operators on your tasks
  collection?"
- Flag clearly when something is a paid/production-only feature (M10+ backups, VPC
  Peering) vs. free-tier-available, so expectations are set correctly.