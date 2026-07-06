# Transactions, MVCC, and Concurrency Control

## What is a transaction?

A transaction is a set of operations that transforms a database from one correct state
to another, treated as an indivisible unit. The **ACID** properties define this:

- **Atomicity** — a transaction fully completes, or fully fails (no partial effects)
- **Consistency** — the database moves from one valid state to another
- **Isolation** — concurrent transactions don't interfere with each other's results
- **Durability** — once committed, changes survive crashes

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
-- or ROLLBACK; to abort and undo everything since BEGIN
```

If any statement fails mid-transaction, the whole transaction should be rolled back —
never leave a transaction in a failed state without explicitly handling it (most
drivers auto-rollback on error, but application code should confirm this).

## MVCC — Multiversion Concurrency Control

PostgreSQL maintains data consistency using **MVCC** rather than traditional
locking. Each SQL statement sees a **snapshot** of the data as of some point in time,
regardless of concurrent changes happening in other sessions. This prevents a
statement from seeing inconsistent data caused by concurrent updates, while providing
transaction isolation per session.

**The core MVCC guarantee: reading never blocks writing, and writing never blocks
reading.** This is fundamentally different from lock-based concurrency control, where
readers and writers can block each other.

### How it works internally

Instead of overwriting a row in place on `UPDATE`, PostgreSQL **inserts a new version**
of the row (a new "tuple") and marks the old version as expired — but the old version
isn't immediately deleted. Each transaction sees the version of each row that was
valid as of its own snapshot. This is why `DELETE`/`UPDATE` doesn't literally remove
data immediately — it marks old versions invisible to future transactions while still
letting in-flight transactions that started earlier see the old data.

### Why `VACUUM` exists

Because MVCC creates new row versions rather than overwriting, "dead" old versions
accumulate over time. If never cleaned up, the database would grow indefinitely and
query performance would degrade. **`VACUUM`** is PostgreSQL's garbage collection
process that reclaims space from dead row versions.

```sql
VACUUM orders;              -- reclaim space, mark it reusable
VACUUM ANALYZE orders;       -- also update planner statistics
VACUUM FULL orders;          -- reclaims space AND compacts the table (locks the table — use sparingly)
```

**`autovacuum`** runs this automatically in the background by default — in almost all
cases you should rely on autovacuum rather than disabling it, tuning its thresholds
instead if needed for high-churn tables.

## Transaction isolation levels

PostgreSQL implements all four SQL-standard isolation levels using MVCC (not
traditional locking) at every level. Notably, **PostgreSQL does not truly implement
Read Uncommitted** — it behaves identically to Read Committed, meaning dirty reads
are never possible at any isolation level in PostgreSQL.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- ... queries ...
COMMIT;

-- Or, set for the whole session
SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

| Level | Dirty read | Non-repeatable read | Phantom read | Notes |
|---|---|---|---|---|
| **Read Uncommitted** | Prevented (PG treats as Read Committed) | Possible | Possible | Not truly implemented separately in PostgreSQL |
| **Read Committed** (default) | Prevented | Possible | Possible | A new snapshot is taken at the start of **each statement** — a long transaction can see different data across its own statements as others commit |
| **Repeatable Read** | Prevented | Prevented | Prevented (stronger than SQL standard requires) | One snapshot for the **whole transaction**, taken at its start |
| **Serializable** | Prevented | Prevented | Prevented | Transactions behave as if executed one at a time in some serial order; may abort with a serialization error requiring retry |

### Read Committed (the default) — good for most OLTP workloads

```sql
BEGIN;  -- implicitly READ COMMITTED
SELECT balance FROM accounts WHERE id = 42;   -- sees snapshot at start of THIS statement
-- (another session updates and commits the row here)
SELECT balance FROM accounts WHERE id = 42;   -- sees a NEW snapshot — reflects the other session's commit
COMMIT;
```

Prevents dirty reads while allowing maximum concurrency — the right default for
API backends and typical transactional workloads.

### Repeatable Read — a stable snapshot for the whole transaction

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM accounts WHERE id = 42;  -- snapshot taken HERE, at transaction start
-- (another session commits a change to this row)
SELECT balance FROM accounts WHERE id = 42;  -- STILL sees the original snapshot value
COMMIT;
```

Ideal for multi-step reports or financial summaries where internal query consistency
matters more than seeing the absolute latest committed data.

### Serializable — strongest guarantee, real cost

Transactions run as if they executed one at a time, in some serial order, even though
they actually ran concurrently. PostgreSQL detects would-be anomalies and aborts one
of the conflicting transactions with a serialization failure — **application code
using SERIALIZABLE must be prepared to catch this error and retry the transaction.**

## Common concurrency anomalies and their fixes

| Anomaly | Description | Fix |
|---|---|---|
| **Lost update** | Two sessions `UPDATE ... WHERE ...` concurrently; the second silently overwrites the first | Use `SELECT ... FOR UPDATE` to lock the row first, or an atomic `UPDATE` expression, or `ON CONFLICT` upserts |
| **Write skew** | Two Read Committed transactions each check a condition, then both update, violating a cross-row invariant the checks were meant to protect | Elevate to `SERIALIZABLE`, or use explicit `SELECT ... FOR UPDATE` locking |

```sql
-- Prevent lost updates with explicit row locking
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;   -- locks the row until COMMIT/ROLLBACK
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

## Savepoints — fine-grained control within a transaction

```sql
BEGIN;
INSERT INTO orders (user_id, amount) VALUES (1, 100);
SAVEPOINT before_risky_step;
UPDATE inventory SET stock = stock - 1 WHERE product_id = 5;
-- if this fails or you want to undo just this part:
ROLLBACK TO SAVEPOINT before_risky_step;
COMMIT;  -- the order insert still commits; the inventory update was rolled back
```

Savepoints work at every isolation level, including Serializable — useful for
"try this step, and undo just this step if it fails" logic without aborting the
entire transaction.

## Locking

MVCC handles most concurrency without locks, but explicit table- and row-level
locking is available for cases needing precise control:

```sql
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;      -- row-level exclusive lock
SELECT * FROM accounts WHERE id = 1 FOR SHARE;       -- row-level shared lock
LOCK TABLE accounts IN EXCLUSIVE MODE;                -- table-level lock
```

PostgreSQL also supports **advisory locks** — application-defined locks not tied
automatically to any specific row/table, useful for coordinating application-level
logic (e.g., ensuring only one worker processes a job) across sessions:

```sql
SELECT pg_advisory_lock(12345);
-- ... critical section ...
SELECT pg_advisory_unlock(12345);
```

## Practical guidance

1. **Read Committed is the right default** — only reach for stronger isolation when
   you have a concrete anomaly to prevent, since stronger isolation means more
   serialization failures/retries and reduced concurrency.
2. **Wrap related writes in a transaction** whenever they must succeed or fail
   together (e.g., debit one account, credit another).
3. **Use `SELECT ... FOR UPDATE`** to prevent lost updates on read-modify-write
   patterns instead of relying on isolation level alone.
4. **If using `SERIALIZABLE`,** your application must catch serialization failure
   errors and retry the transaction — this isolation level is a deliberate trade of
   throughput for correctness guarantees.
5. **Don't disable `autovacuum`** — if a high-churn table needs tuning, adjust its
   autovacuum thresholds rather than turning it off, or dead tuples will accumulate
   and degrade performance over time.