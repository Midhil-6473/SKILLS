# Beginner → Advanced Learning Path (PostgreSQL)

Use this as a curriculum when the user wants a structured roadmap rather than a point
answer. Each phase names the reference file(s) to pull detail from.

## Phase 0 — Orientation (15 minutes)

- Understand what a relational database is and where PostgreSQL fits vs. document
  databases like MongoDB. See `fundamentals.md`.
- Understand tables, rows, columns, and the idea of relationships via foreign keys.
- Decide: local install vs. a managed platform. **Recommendation for beginners: start
  with Supabase or Neon's free tier** — zero install friction, same SQL you'll use
  everywhere else.

**Practice:** Create a free Supabase or Neon project (see `hosting_and_ai.md`).

## Phase 1 — SQL Basics

*Read: `fundamentals.md` + `queries.md`*

1. `CREATE TABLE`, `INSERT`, basic `SELECT` with `WHERE`.
2. `UPDATE` and `DELETE`.
3. Basic `JOIN` between two related tables.
4. `GROUP BY` with aggregate functions (`COUNT`, `SUM`, `AVG`).
5. Try `psql` directly, or your platform's SQL editor.

**Practice project:** Create `users` and `orders` tables with a foreign key, insert
sample data, and write 5 queries: filter, join, group-and-aggregate, sort, paginate.

## Phase 2 — Data Types & Table Design

*Read: `data_types_and_design.md`*

1. Learn the core data types, especially `NUMERIC` for money and `TIMESTAMPTZ` for
   dates.
2. Learn `JSONB` for semi-structured columns — and when to use it vs. normal columns.
3. Add constraints: `NOT NULL`, `UNIQUE`, `CHECK`, foreign keys with `ON DELETE`
   actions.
4. Understand normalization (1NF/2NF/3NF) and design a small normalized schema.
5. Try a many-to-many relationship with a join table.

**Practice project:** Design a schema for a blog (users, posts, tags) with a
many-to-many relationship between posts and tags via a join table. Add appropriate
constraints.

## Phase 3 — Intermediate SQL

*Read: `queries.md`*

1. Subqueries (in `WHERE`, in `FROM`, correlated).
2. Common Table Expressions (`WITH` queries) for readability.
3. Window functions — running totals, `RANK()`, `ROW_NUMBER()`.
4. `UPSERT` with `INSERT ... ON CONFLICT`.
5. `RETURNING` to get modified rows back without an extra query.

**Practice project:** Write a query using a CTE and a window function to find each
user's top 3 highest-value orders, ranked.

## Phase 4 — Indexes & Performance

*Read: `indexes_and_performance.md`*

1. Create B-tree indexes on frequently filtered/joined columns.
2. Use `EXPLAIN ANALYZE` to confirm index usage (`Index Scan` vs `Seq Scan`).
3. Try a GIN index on a `JSONB` column and query it with `@>`.
4. Try a partial index for a common filtered query.

**Practice project:** Take 2-3 queries from your blog schema, run `EXPLAIN ANALYZE`
before and after adding indexes, and confirm the plan changes from `Seq Scan` to
`Index Scan`.

## Phase 5 — Transactions & Concurrency

*Read: `transactions_and_concurrency.md`*

1. Wrap a multi-statement operation in `BEGIN`/`COMMIT`/`ROLLBACK`.
2. Understand MVCC conceptually — why PostgreSQL doesn't need read locks.
3. Understand the four isolation levels and when Read Committed (the default) is
   enough vs. when you'd reach for something stronger.
4. Try `SELECT ... FOR UPDATE` to prevent a lost update.

**Practice project:** Simulate a "transfer between two accounts" scenario in a
transaction, and use `SELECT ... FOR UPDATE` to make it safe under concurrent access.

## Phase 6 — Views, Functions, Triggers

*Read: `functions_views_triggers.md`*

1. Create a view for a commonly-repeated query.
2. Create a materialized view for an expensive aggregate, and refresh it manually.
3. Write a simple PL/pgSQL function.
4. Add a trigger to auto-update an `updated_at` timestamp column.

**Practice project:** Add a materialized view summarizing post counts per tag, and a
trigger that maintains an `updated_at` column on your `posts` table.

## Phase 7 — Roles & Security

*Read: `roles_and_security.md`*

1. Create a scoped application role instead of using the superuser for app code.
2. `GRANT` only the privileges that role actually needs.
3. Try Row-Level Security on a table — e.g., restrict a `posts` table so users only
   see their own drafts.

**Practice project:** Add RLS to your blog schema so a `drafts` table only shows each
user their own unpublished posts.

## Phase 8 — ORM & Backend Integration

*Read: `backend_integrations.md`*

1. Pick a stack matching your language: Prisma or Drizzle (Node/TypeScript),
   SQLAlchemy or Django (Python), Spring Data JPA (Java).
2. Define your blog schema as ORM models/entities with relationships.
3. Build a small REST API (Express, FastAPI, or Spring Boot) with CRUD routes.
4. Handle a unique-constraint violation cleanly instead of a raw 500 error.

**Practice project:** Rebuild your blog schema in your chosen ORM, then build a
minimal REST API exposing posts (list, create, update, delete).

## Phase 9 — Replication, Partitioning, Production Operations

*Read: `scaling_and_production.md`*

1. Understand streaming replication conceptually — primary/standby, WAL shipping.
2. Understand when partitioning would help (e.g., a huge time-series `events` table).
3. Try `pg_dump`/`pg_restore` for a backup and restore cycle.
4. Look at `pg_stat_activity` and `pg_stat_user_indexes` to understand monitoring.

**Practice project:** Back up your practice database with `pg_dump`, drop a table,
and restore it with `pg_restore` to confirm the process works end to end.

## Phase 10 — Managed Platforms & AI/Vector Search (optional)

*Read: `hosting_and_ai.md`*

1. If not already using one, try Supabase or Neon and compare the experience to
   self-managed setup.
2. If building an AI/RAG app: install `pgvector`, create a `VECTOR` column, and run a
   similarity search query.
3. If using LangChain/LlamaIndex: wire up `PGVector`/`PGVectorStore` as the vector
   store backend.

**Practice project:** Add a `pgvector` column to a small articles table, generate
embeddings for a handful of documents, and run a cosine-similarity query to find the
most relevant one for a sample question.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer with a
specific production task):
- Go phase by phase, one small concrete project per phase, rather than a wall of docs.
- Default to a free managed platform (Supabase or Neon) for all practice — no reason
  to fight with local Postgres installation for learning purposes.
- Check understanding with a quick build before advancing — e.g., "before we move to
  indexes, want to try writing a query with a window function on your orders table?"
- Flag clearly when something is a paid/production-only concern (replication,
  partitioning, RDS Multi-AZ) vs. something to practice immediately on a free tier.