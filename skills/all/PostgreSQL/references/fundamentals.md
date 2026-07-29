# PostgreSQL Fundamentals — Relational Databases, Tables, SQL Basics

## What is a database? (starting from zero)

A database is software that stores data durably and lets applications query it
reliably, efficiently, and concurrently — without it, an application would need to
reinvent indexing, concurrent access, and crash recovery from raw files.

## What is a relational database?

PostgreSQL is a **relational database management system (RDBMS)** — a system for
managing data stored in **relations**. "Relation" is the mathematical term for what is
commonly called a **table**. Each table is a named collection of rows; every row in a
given table has the same set of named columns, and each column has a specific data
type. Columns have a fixed order within a row, but SQL does not guarantee any
particular ordering of rows within a table.

Other database organizational models exist — a Unix filesystem is an example of a
hierarchical database, and object-oriented databases are a more modern alternative —
but the table-based relational model remains the dominant approach for structured data.

## What is PostgreSQL specifically?

PostgreSQL is an **object-relational database management system (ORDBMS)**, based on
POSTGRES Version 4.2 developed at UC Berkeley. It's an open-source descendant of that
original code, and supports a large part of the SQL standard while adding many modern
features: complex queries, foreign keys, triggers, updatable views, transactional
integrity, and multiversion concurrency control (MVCC). It's extensible — you can
define your own data types, operators, index types, and even procedural languages.

Because of its liberal (permissive) license, PostgreSQL can be used, modified, and
distributed by anyone, free of charge, for any purpose — private, commercial, or
academic.

## Creating a table (the "hello world" of SQL)

```sql
CREATE TABLE users (
    id      INTEGER PRIMARY KEY,
    name    TEXT NOT NULL,
    email   TEXT UNIQUE NOT NULL,
    age     INTEGER
);
```

## Populating a table

```sql
INSERT INTO users (id, name, email, age) VALUES
    (1, 'Alice', 'alice@example.com', 30),
    (2, 'Bob', 'bob@example.com', 25);
```

## Querying a table

```sql
SELECT * FROM users;
SELECT name, email FROM users WHERE age > 26;
```

## Joins between tables

```sql
CREATE TABLE orders (
    id       INTEGER PRIMARY KEY,
    user_id  INTEGER REFERENCES users(id),
    product  TEXT,
    amount   NUMERIC(10,2)
);

SELECT users.name, orders.product, orders.amount
FROM users
JOIN orders ON users.id = orders.user_id;
```

This is the fundamental difference from a document database: related data lives in
**separate tables**, connected by a foreign key (`orders.user_id` referencing
`users.id`), and joined together at query time rather than nested/embedded.

## Aggregate functions

```sql
SELECT user_id, SUM(amount) AS total_spent
FROM orders
GROUP BY user_id;
```

## Updates and deletions

```sql
UPDATE users SET age = 31 WHERE id = 1;
DELETE FROM users WHERE id = 2;
```

## `psql` — the official interactive terminal

```bash
psql -h localhost -U myuser -d mydatabase

\l          -- list databases
\c mydb     -- connect to a database
\dt         -- list tables
\d users    -- describe the users table (columns, types, indexes, constraints)
\q          -- quit
```

`psql` is PostgreSQL's official command-line client, analogous to `mongosh` for
MongoDB — the standard tool for interactive queries, administration, and scripting.

## Databases, schemas, and tables — the containment hierarchy

- A **PostgreSQL server (cluster)** can host multiple **databases**.
- Each database contains one or more **schemas** (namespaces for organizing tables —
  the default schema is `public`).
- Each schema contains **tables**, **views**, **functions**, **indexes**, and other
  objects.

```sql
CREATE SCHEMA analytics;
CREATE TABLE analytics.events (id INTEGER PRIMARY KEY, event_name TEXT);
```

Schemas are useful for organizing large databases (e.g., separating `public` app
tables from an `analytics` or `audit` schema) without needing separate databases.

## When to choose PostgreSQL vs. a document database

**Choose PostgreSQL when:**
- Your data is naturally tabular with well-defined relationships (users, orders,
  products, invoices) that benefit from foreign key constraints and JOINs
- You need strong ACID guarantees and complex multi-table transactions
- You need powerful ad-hoc analytical queries (window functions, CTEs, full outer
  joins) across normalized data
- You want a single database that can also handle JSON (via `JSONB`), full-text search,
  geospatial data (PostGIS), and vector embeddings (`pgvector`) — reducing the number
  of separate systems you operate

**Choose a document database (e.g., MongoDB) when:**
- Your data's natural shape is deeply nested/hierarchical and evolves frequently
- You want to avoid schema migrations blocking releases
- Horizontal write scaling across many commodity servers is a primary requirement

In practice, many production systems use PostgreSQL as the primary system of record —
its combination of reliability, SQL standard support, and extensibility make it a
very common default choice across web, mobile, analytics, and AI/RAG applications.