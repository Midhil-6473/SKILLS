# Views, Functions, Triggers, and Extensions

## Views — saved, reusable queries

A view is a named, stored query that behaves like a virtual table. It doesn't store
data itself (unless materialized — see below); it re-runs its defining query each time
it's selected from.

```sql
CREATE VIEW active_users AS
    SELECT id, name, email FROM users WHERE deleted_at IS NULL;

SELECT * FROM active_users WHERE name LIKE 'A%';
```

### Updatable views

Simple views (single table, no aggregates/DISTINCT/GROUP BY) are automatically
updatable — `INSERT`/`UPDATE`/`DELETE` against the view passes through to the
underlying table:

```sql
UPDATE active_users SET name = 'Alice Smith' WHERE id = 1;  -- updates the real users table
```

### Materialized views — cached, physically stored results

```sql
CREATE MATERIALIZED VIEW monthly_sales AS
    SELECT date_trunc('month', order_date) AS month, SUM(amount) AS total
    FROM orders
    GROUP BY 1;

-- Must be manually (or scheduled to be) refreshed — it does NOT auto-update
REFRESH MATERIALIZED VIEW monthly_sales;
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_sales;  -- non-blocking, requires a unique index
```

Use materialized views for expensive aggregate queries (dashboards, reports) where
slightly-stale data is acceptable in exchange for dramatically faster reads —
refresh on a schedule (cron, pg_cron, or application-triggered) rather than on every
read.

## Functions — reusable server-side logic

```sql
CREATE OR REPLACE FUNCTION total_spent_by_user(p_user_id INTEGER)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(amount), 0) FROM orders WHERE user_id = p_user_id;
$$ LANGUAGE SQL;

SELECT total_spent_by_user(1);
```

### PL/pgSQL — PostgreSQL's procedural language for more complex logic

```sql
CREATE OR REPLACE FUNCTION apply_discount(p_order_id INTEGER, p_percent NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE orders
    SET amount = amount * (1 - p_percent / 100.0)
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

PL/pgSQL supports variables, conditionals, loops, exception handling — a full
procedural language embedded in the database, useful for logic that must run
atomically alongside data access without a round trip to application code.

### Functions returning tables (set-returning functions)

```sql
CREATE OR REPLACE FUNCTION get_top_customers(p_limit INTEGER)
RETURNS TABLE(user_id INTEGER, total_spent NUMERIC) AS $$
    SELECT user_id, SUM(amount) FROM orders GROUP BY user_id ORDER BY 2 DESC LIMIT p_limit;
$$ LANGUAGE SQL;

SELECT * FROM get_top_customers(5);
```

## Stored procedures (distinct from functions, since PostgreSQL 11+)

Procedures can manage their own transactions (`COMMIT`/`ROLLBACK` inside the body),
which functions cannot:

```sql
CREATE OR REPLACE PROCEDURE process_batch()
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE orders SET status = 'processed' WHERE status = 'pending';
    COMMIT;
    -- more steps, each can commit independently
END;
$$;

CALL process_batch();
```

## Triggers — automatic actions on data changes

```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
```

### Common trigger use cases

```sql
-- Audit logging: record every change to a table
CREATE OR REPLACE FUNCTION log_order_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO order_audit_log (order_id, old_status, new_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_status_change
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_order_changes();
```

| Trigger timing | When it fires |
|---|---|
| `BEFORE` | Before the operation — can modify `NEW` or cancel the operation by returning `NULL` |
| `AFTER` | After the operation completes — cannot modify the row, used for side effects (logging, notifications) |
| `INSTEAD OF` | Replaces the operation entirely — used on views to make them updatable |

**Use triggers sparingly and document them well** — they're "invisible" side effects
that can surprise developers reading only application code. Reserve them for things
that must be enforced at the database level regardless of which application/service
writes to the table (audit trails, invariant enforcement), not for business logic
better placed in application code.

## `LISTEN`/`NOTIFY` — lightweight pub/sub

```sql
-- Session A
LISTEN order_created;

-- Session B (e.g., inside a trigger or application code)
NOTIFY order_created, '{"order_id": 123}';
```

A built-in, lightweight publish/subscribe mechanism — useful for cache invalidation or
triggering application-side work in response to database events, without needing a
separate message queue for simple cases.

## Extensions — PostgreSQL's extensibility model

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- cryptographic functions, gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- alternative UUID generation functions
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- trigram matching for fuzzy text search
CREATE EXTENSION IF NOT EXISTS postgis;     -- geospatial data types and functions
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector: embeddings for AI/RAG (see hosting_and_ai.md)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- query performance statistics
```

Extensions are how PostgreSQL adds major capabilities (geospatial, vector search,
cryptography, fuzzy matching) without bloating the core — this modular extensibility
is a defining PostgreSQL strength versus most other relational databases.

## Practical guidance on views/functions/triggers

1. **Use views** to encapsulate commonly-repeated complex queries, or to expose a
   simplified/restricted interface to a table (combine with RLS for row-level
   restriction, or column selection for a narrower interface).
2. **Use materialized views** for expensive aggregate/reporting queries where
   eventual consistency is fine — refresh on a schedule.
3. **Use functions** for reusable logic called from multiple queries, or to expose a
   clean API to application code for complex operations.
4. **Use triggers** only for cross-cutting invariants (audit trails, timestamp
   maintenance, cache invalidation notifications) — not as a substitute for
   application-level business logic, which is easier to test, version, and reason
   about outside the database.
5. **Reach for extensions early** rather than building fuzzy search, geospatial
   queries, or vector similarity yourself — PostgreSQL's extension ecosystem covers
   nearly all of this natively.