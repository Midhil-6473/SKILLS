# Indexes & Performance — Types, EXPLAIN, Optimization

## Why indexes matter

Without an index, PostgreSQL must perform a **sequential scan** — reading every row to
find matches. An index lets the planner jump directly to matching rows. Trade-off:
indexes speed up reads but add overhead to every write (inserts/updates must also
maintain the index) and consume additional storage.

## Creating indexes

```sql
CREATE INDEX idx_users_email ON users (email);
CREATE UNIQUE INDEX idx_users_email_unique ON users (email);
CREATE INDEX idx_orders_status_created ON orders (status, created_at);  -- compound index

DROP INDEX idx_users_email;
```

`CREATE INDEX` defaults to a **B-tree** index — the right choice for the vast majority
of situations.

## Index types — PostgreSQL provides several, each suited to different query patterns

| Type | Best for |
|---|---|
| **B-tree** (default) | Equality and range queries (`=`, `<`, `>`, `BETWEEN`, `IN`), sorting. The right default choice. |
| **Hash** | Equality-only lookups; smaller/faster than B-tree for pure `=` comparisons, but can't support ranges or sorting. |
| **GIN** (Generalized Inverted Index) | Composite/multi-value data: `JSONB`, arrays, full-text search (`tsvector`). |
| **GiST** (Generalized Search Tree) | Geometric/spatial data, range types, nearest-neighbor searches; supports lossy storage. |
| **SP-GiST** | Non-balanced data structures — quadtrees, k-d trees, tries; e.g., 2D points. |
| **BRIN** (Block Range Index) | Very large tables where column values correlate with physical row order (e.g., an append-only timestamp column). Extremely compact. |

```sql
-- Hash: equality-only, e.g. a session token lookup
CREATE INDEX idx_sessions_token ON sessions USING HASH (session_token);

-- GiST: geometric/range data
CREATE INDEX idx_bookings_during ON bookings USING GIST (during);

-- BRIN: huge, naturally-ordered table (e.g. an events log by timestamp)
CREATE INDEX idx_events_created_brin ON events USING BRIN (created_at);
```

### B-tree vs BRIN vs GIN vs GiST — the mental model

- **B-tree** — default choice for most scenarios; range/equality/sorting.
- **BRIN** — very large, naturally ordered tables (huge storage savings vs B-tree).
- **GIN** — arrays, JSONB, full-text search: "does this composite value contain X?"
- **GiST** — spatial/geometric data, ranges, nearest-neighbor queries.

## GIN indexes for JSONB — the critical AI/modern-app pattern

A plain B-tree doesn't work well for indexing inside a `JSONB` column's nested
structure. GIN is the standard solution:

```sql
CREATE TABLE api_docs (id INTEGER PRIMARY KEY, jdoc JSONB);

-- Default operator class (jsonb_ops) — supports ?, ?|, ?&, @>, @?, @@
CREATE INDEX idx_jdoc_gin ON api_docs USING GIN (jdoc);

-- Query using the containment operator @> — uses the index
SELECT jdoc->'name' FROM api_docs WHERE jdoc @> '{"company": "Acme"}';
```

### `jsonb_ops` (default) vs `jsonb_path_ops`

```sql
-- jsonb_path_ops: smaller, faster index, but supports fewer operators (@>, @?, @@ only)
CREATE INDEX idx_jdoc_path_gin ON api_docs USING GIN (jdoc jsonb_path_ops);
```

Use `jsonb_path_ops` when your queries only ever use containment (`@>`) — it's
usually much smaller and faster than the default `jsonb_ops`, at the cost of not
supporting the key-existence operators (`?`, `?|`, `?&`).

### Expression indexes — an alternative for known, static JSONB queries

```sql
-- Index a specific extracted, cast value for range queries
CREATE INDEX idx_order_total ON orders ((details->>'order_total')::numeric);

-- This query uses the index (must match the expression EXACTLY):
SELECT * FROM orders WHERE (details->>'order_total')::numeric > 100;
```

**Rule of thumb:** use GIN for containment-style lookups when you don't know the full
JSONB schema ahead of time; use a B-tree expression index when you have a specific,
static, frequently-run query against a known JSON key.

**Caveat:** GIN indexes have higher write overhead than B-tree — every insert/update
touches multiple index entries. For bulk loads, consider creating the GIN index
*after* loading data, or use the `fastupdate` storage parameter.

## Full-text search (built-in, using GIN)

```sql
ALTER TABLE articles ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_articles_fts ON articles USING GIN (content_tsv);

SELECT title FROM articles WHERE content_tsv @@ to_tsquery('english', 'postgres & database');
```

## Partial indexes — index only a relevant subset

```sql
-- If most orders are 'completed' and queries mostly target 'pending' ones
CREATE INDEX idx_orders_pending ON orders (created_at) WHERE status = 'pending';
```

Reduces index size and maintenance overhead when queries consistently filter on the
same condition.

## Covering indexes — avoid a heap lookup entirely

```sql
CREATE INDEX idx_orders_covering ON orders (status) INCLUDE (amount, created_at);
```

The `INCLUDE` clause (PostgreSQL 11+) adds extra columns to the index leaf pages
without making them part of the index key — lets an "index-only scan" satisfy a query
without touching the underlying table, when the query only needs indexed + included
columns.

## `EXPLAIN` — verifying index usage

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'shipped' ORDER BY created_at DESC;
```

Look for:
- **`Index Scan`** or **`Index Only Scan`** — good, the index is being used
- **`Bitmap Heap Scan`** / **`Bitmap Index Scan`** — index used, common for GIN and
  multi-condition queries
- **`Seq Scan`** — sequential (full table) scan — usually means a missing or unused
  index for this query

```sql
-- Sample output interpretation
-- Index Scan using idx_orders_status_created on orders  (cost=0.29..8.31 rows=1)
--   Index Cond: (status = 'shipped'::text)
```

## Practical indexing guidance

1. **Index columns used in `WHERE`, `JOIN ON`, and `ORDER BY`** — this covers most
   real-world needs.
2. **Order compound index columns: equality columns first, then range/sort columns** —
   analogous to MongoDB's ESR rule; PostgreSQL's planner benefits from the same logic.
3. **Don't over-index** — every index adds write overhead and storage. Periodically
   check `pg_stat_all_indexes` (specifically `idx_scan`) to find and drop unused
   indexes.
4. **Use `EXPLAIN ANALYZE` before and after adding an index** to confirm it's actually
   being chosen by the planner — an index that exists but isn't used provides zero
   benefit while still costing writes.
5. **`VACUUM` and `ANALYZE` regularly** (usually handled automatically by
   `autovacuum`) — outdated table statistics can cause the planner to make poor
   index-usage decisions. See `transactions_and_concurrency.md` for why VACUUM is
   necessary at all (MVCC dead tuple cleanup).
6. **Use `CREATE INDEX CONCURRENTLY`** in production to avoid locking the table
   against writes while the index builds — slower to build, but non-blocking.

```sql
CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);
```