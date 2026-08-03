# Replication, Partitioning, Backup & Production Operations

## Replication — high availability and read scaling

PostgreSQL supports **streaming replication**: a primary server continuously ships its
Write-Ahead Log (WAL) to one or more standby (replica) servers, which apply it to stay
in sync.

- **Physical replication** — byte-for-byte replica of the entire database cluster;
  standbys can serve read-only queries (`hot_standby`).
- **Logical replication** — replicates at the level of individual tables/rows via
  a publish/subscribe model, allowing selective replication and even replication
  between different major PostgreSQL versions.

```sql
-- Logical replication: on the publisher
CREATE PUBLICATION my_pub FOR TABLE orders, users;

-- On the subscriber
CREATE SUBSCRIPTION my_sub
    CONNECTION 'host=primary_host dbname=mydb user=replicator password=secret'
    PUBLICATION my_pub;
```

**High availability** typically combines streaming replication with a failover
mechanism (e.g., Patroni, repmgr, or a managed platform's built-in failover) — unlike
MongoDB's built-in automatic replica set elections, PostgreSQL's core doesn't include
automatic failover orchestration out of the box; you either build it with tooling or
rely on a managed provider (see `hosting_and_ai.md`).

## Partitioning — splitting large tables

Partitioning divides a large logical table into smaller physical pieces, improving
query performance and maintenance operations (like bulk deletes) on very large tables.

```sql
-- Range partitioning by date (common for time-series/log data)
CREATE TABLE events (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    event_type TEXT,
    created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_01 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE events_2026_02 PARTITION OF events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

```sql
-- List partitioning (e.g., by region/tenant)
CREATE TABLE orders (
    id BIGINT, region TEXT, amount NUMERIC
) PARTITION BY LIST (region);

CREATE TABLE orders_us PARTITION OF orders FOR VALUES IN ('US');
CREATE TABLE orders_eu PARTITION OF orders FOR VALUES IN ('EU');
```

```sql
-- Hash partitioning (even distribution when no natural range/list key exists)
CREATE TABLE sessions (id UUID, data JSONB) PARTITION BY HASH (id);
CREATE TABLE sessions_0 PARTITION OF sessions FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE sessions_1 PARTITION OF sessions FOR VALUES WITH (modulus 4, remainder 1);
-- ... etc for remainder 2, 3
```

**Benefits:** queries filtering on the partition key can skip entire partitions
("partition pruning"), and maintenance like `DROP TABLE events_2025_01` becomes an
instant way to purge old data instead of a slow `DELETE`.

**When to partition:** once a single table's size or maintenance burden (vacuum time,
index bloat) becomes a genuine operational problem — not a default starting design.

## Backup and restore

```bash
# Logical backup (SQL dump) — portable, human-readable, works across versions
pg_dump -U myuser -d mydb -F c -f mydb_backup.dump

# Restore
pg_restore -U myuser -d mydb mydb_backup.dump

# Full cluster (all databases)
pg_dumpall -U postgres > full_backup.sql
```

```bash
# Physical backup (file-level, faster for very large databases)
pg_basebackup -D /backup/path -U replicator -h primary_host -Fp -Xs -P
```

### Point-in-time recovery (PITR)

Continuous WAL archiving + a base backup lets you restore to any specific moment in
time (e.g., "restore to 30 seconds before the accidental DROP TABLE"), not just to the
last full backup — essential for production disaster recovery beyond simple periodic
dumps.

## Monitoring

```sql
-- Currently running queries
SELECT pid, query, state, query_start FROM pg_stat_activity WHERE state != 'idle';

-- Index usage statistics (find unused indexes)
SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan ASC;

-- Table bloat / dead tuple check
SELECT relname, n_dead_tup, n_live_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;

-- Long-running/blocking queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '5 minutes';
```

`pg_stat_statements` (an extension) provides aggregated query performance statistics —
essential for identifying your slowest/most frequent queries in production.

## Connection pooling

PostgreSQL's per-connection memory overhead means a large number of idle application
connections can exhaust server resources. **PgBouncer** (or **Pgpool-II**) is the
standard connection pooler, sitting between the application and PostgreSQL,
multiplexing many client connections onto a smaller pool of actual database
connections.

```ini
# pgbouncer.ini (simplified)
[databases]
mydb = host=localhost port=5432 dbname=mydb

[pgbouncer]
pool_mode = transaction   # or session, statement
max_client_conn = 1000
default_pool_size = 20
```

This is especially critical in serverless deployments (Lambda, Vercel/Next.js edge
functions) where each function invocation might otherwise open a fresh connection —
see `backend_integrations.md` for the connection-pooling pattern in that context.

## Production checklist

1. **Set up streaming replication** (or use a managed platform that provides it) for
   high availability — don't run a single unreplicated instance in production.
2. **Configure WAL archiving for point-in-time recovery**, not just periodic
   `pg_dump` snapshots.
3. **Use a connection pooler (PgBouncer)** if your application creates many
   short-lived connections (very common with serverless architectures).
4. **Monitor `pg_stat_activity` for long-running/blocking queries** and
   `pg_stat_user_tables`/`pg_stat_user_indexes` for bloat and unused indexes.
5. **Tune `autovacuum` thresholds** for high-churn tables rather than disabling it.
6. **Partition very large tables** once size/maintenance genuinely becomes a
   bottleneck — not preemptively.
7. **Test your backup restore process** — an untested backup is not a real backup.
8. **Use `scram-sha-256` auth, TLS connections, and least-privilege roles** (see
   `roles_and_security.md`) before considering a deployment production-ready.