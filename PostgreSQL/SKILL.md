---
name: postgresql-architect
description: >
  Complete architect's manual for PostgreSQL, the world's most advanced open source
  relational database. Use whenever the user asks about PostgreSQL or Postgres,
  relational databases in general (what a database is, SQL basics, when to use a
  relational vs document database), data types (including JSONB and arrays), table
  design and normalization, SQL queries (SELECT, JOIN, subqueries, CTEs, window
  functions), indexes (B-tree, GIN, GiST, BRIN), transactions and MVCC, roles and
  permissions, views, stored procedures/functions, triggers, replication, partitioning,
  performance tuning and EXPLAIN, or integrating PostgreSQL with backend frameworks and
  ORMs such as Node.js (Prisma, Sequelize, TypeORM), Python (SQLAlchemy, Django, Psycopg),
  Java (Spring Boot/Hibernate), or hosted platforms like Supabase, Neon, or Amazon RDS.
  Also trigger for beginner questions about what a database is, SQL vs NoSQL, how to
  design a schema, how to write a JOIN, or how to connect an app to Postgres.
---

# The PostgreSQL Architect's Manual

You are acting as an expert PostgreSQL architect and backend engineer. This skill
covers PostgreSQL from "what is a relational database" through advanced performance
tuning and full-stack framework/ORM integration.

**Docs home:** `postgresql.org/docs/current/`

## What is PostgreSQL?

PostgreSQL is an open-source **object-relational database management system (ORDBMS)**,
descended from the POSTGRES project at UC Berkeley. It supports a large part of the SQL
standard and offers many modern features: complex queries, foreign keys, triggers,
updatable views, transactional integrity, multiversion concurrency control (MVCC), and
extensibility (custom types, operators, functions, even procedural languages). Because
of its liberal license, PostgreSQL can be used, modified, and distributed by anyone
free of charge, for any purpose.

## What is a relational database? (starting from zero)

A **relational database** stores data in **relations** — the mathematical term for
what everyone calls a table. Each table is a named collection of rows; every row in a
given table has the same set of named columns, and each column has a specific data
type. SQL does not guarantee any particular row order within a table.

```
Table: users
| id | name    | email               |
|----|---------|---------------------|
| 1  | Alice   | alice@example.com   |
| 2  | Bob     | bob@example.com     |
```

Relationships between tables are expressed via **foreign keys** — a column in one
table referencing the primary key of another — and combined at query time with
**JOINs**, rather than nesting data as a document database would.

## Relational (SQL) vs. Document (NoSQL) — when to pick which

| | Relational — PostgreSQL | Document — MongoDB |
|---|---|---|
| Unit of storage | Row in a table with a fixed schema | Flexible JSON-like document |
| Schema | Enforced upfront by the database | Flexible, evolves per-document |
| Relationships | Foreign keys + JOINs | Embedding or manual references |
| Best for | Structured, relationship-heavy data with strong consistency needs (financial ledgers, inventories, multi-entity systems) | Evolving, hierarchical, non-uniform data |
| Consistency | Strong ACID guarantees via MVCC by default | Tunable; strong within a document |

PostgreSQL is also a strong hybrid choice — its native `JSONB` type with GIN indexing
lets you store and efficiently query semi-structured/document-like data **inside** a
relational database, when you want SQL's guarantees plus document flexibility for
specific columns.

## Where PostgreSQL is used

- Transactional backends for web/mobile apps (the "P" often implied in many modern
  full-stack templates: Postgres + a Node/Python/Java backend + a frontend framework)
- Financial systems, inventory, and anything needing strict ACID guarantees
- Analytics and reporting (window functions, CTEs, powerful aggregate queries)
- Geospatial applications (PostGIS extension)
- Full-text search (built-in `tsvector`/`tsquery`, GIN indexes)
- AI/RAG applications (via the `pgvector` extension for embeddings)
- As the managed database behind platforms like Supabase, Neon, Amazon RDS, and
  Google Cloud SQL

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Databases 101, tables, relations, SQL basics, when to choose Postgres | `references/fundamentals.md` |
| Data types (including JSONB, arrays, ranges), table design, constraints, normalization | `references/data_types_and_design.md` |
| SQL queries: SELECT, JOINs, subqueries, CTEs, window functions, aggregates | `references/queries.md` |
| Indexes: B-tree, Hash, GIN, GiST, BRIN, partial/expression indexes, EXPLAIN | `references/indexes_and_performance.md` |
| Transactions, MVCC, isolation levels, locking | `references/transactions_and_concurrency.md` |
| Roles, permissions, GRANT/REVOKE, Row-Level Security | `references/roles_and_security.md` |
| Views, functions/stored procedures, triggers, extensions | `references/functions_views_triggers.md` |
| Replication, partitioning, backup/restore, production operations | `references/scaling_and_production.md` |
| ORMs and backend integration: Prisma, Sequelize, TypeORM, SQLAlchemy, Django, Spring Boot, Node/Express/Next.js | `references/backend_integrations.md` |
| Managed Postgres platforms: Supabase, Neon, Amazon RDS; pgvector for AI/RAG | `references/hosting_and_ai.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Normalize first, denormalize deliberately.** Unlike document databases, start
   from a normalized relational design (see `data_types_and_design.md`), and only
   denormalize for a measured performance reason.
2. **Every table should have a primary key** — prefer `GENERATED ALWAYS AS IDENTITY`
   (modern) over the legacy `SERIAL` type for auto-incrementing keys.
3. **Index what you filter and join on**, and always verify with `EXPLAIN ANALYZE` —
   don't guess whether an index is used.
4. **Use transactions for multi-statement operations that must be atomic** — wrap
   related INSERT/UPDATE/DELETE statements in `BEGIN...COMMIT`.
5. **Default to `READ COMMITTED`** (Postgres's default isolation level) for typical
   OLTP workloads; reach for `REPEATABLE READ` or `SERIALIZABLE` only when you have a
   concrete concurrency anomaly to prevent.
6. **Use environment variables for connection strings/credentials** — never hardcode.
7. **Use `JSONB` (not `JSON`) for any semi-structured column** you plan to query or
   index — `JSONB` is stored decomposed and binary, `JSON` just stores the exact input
   text.
8. **Least privilege for roles** — don't connect application code as a superuser;
   create scoped roles with `GRANT` for only the tables/operations needed.
9. **Source of truth:** `postgresql.org/docs/current`. If the user's question involves
   a very recent version (PostgreSQL ships major annual releases — 18, 19, etc.) or a
   specific extension, web-search the official docs rather than guessing.