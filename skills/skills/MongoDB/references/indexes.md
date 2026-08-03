# Indexes — Types, Compound Indexes, the ESR Rule, Performance

## Why indexes matter

Without an index, MongoDB must perform a **collection scan** (`COLLSCAN`) — checking
every document to find matches. An index lets it jump directly to matching documents,
the same way a book index lets you skip to a page instead of reading cover to cover.
The trade-off: indexes speed up reads but add overhead to writes (every insert/update
must also update relevant indexes) and consume additional storage.

## Creating indexes

```js
// Single-field index
db.users.createIndex({ email: 1 })     // 1 = ascending, -1 = descending

// Compound index (multiple fields, order matters — see ESR rule below)
db.orders.createIndex({ status: 1, createdAt: -1 })

// Unique index
db.users.createIndex({ email: 1 }, { unique: true })

// List all indexes on a collection
db.users.getIndexes()

// Drop an index
db.users.dropIndex("email_1")
```

## Index types

| Type | Use case |
|---|---|
| **Single field** | Basic equality/range queries on one field |
| **Compound** | Queries filtering/sorting on multiple fields together |
| **Multikey** | Automatically created when you index a field containing an array — indexes each array element |
| **Text** | Full-text search on string content (`$text` queries) |
| **Geospatial (2dsphere)** | Location-based queries (`$near`, `$geoWithin`) |
| **Hashed** | Even data distribution — commonly used as a shard key index |
| **Wildcard** | Index unknown/dynamic field names (useful for highly polymorphic documents) |
| **TTL (Time-To-Live)** | Automatically deletes documents after a set duration — great for sessions, logs, caches |
| **Partial** | Only indexes documents matching a filter expression — smaller, faster index for a common subset of queries |

```js
// Text index
db.articles.createIndex({ content: "text" })
db.articles.find({ $text: { $search: "mongodb tutorial" } })

// TTL index — auto-delete sessions after 1 hour (3600 seconds)
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })

// Partial index — only index active users (saves space if most users are inactive)
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { status: "active" } }
)
```

## The ESR Rule for compound indexes

When designing a compound index, order fields as: **Equality → Sort → Range**.

```js
// Query: find shipped orders with amount >= 100, sorted by createdAt descending
db.orders.find({ status: "shipped", amount: { $gte: 100 } }).sort({ createdAt: -1 })

// ESR-ordered compound index:
db.orders.createIndex({ status: 1, createdAt: -1, amount: 1 })
//                       ^Equality  ^Sort         ^Range
```

Why this order: equality fields narrow the search fastest, then sort fields let
MongoDB return results already in sorted order without an extra in-memory sort, and
range fields are applied last since they can't be an exact index seek target.

## Verifying index usage with `explain()`

```js
db.orders.find({ status: "shipped" }).sort({ createdAt: -1 }).explain("executionStats")
```

Look for `"stage": "IXSCAN"` (index scan — good) vs. `"stage": "COLLSCAN"` (collection
scan — usually means you need an index). The `winningPlan` field shows exactly which
index (if any) MongoDB chose.

## Aggregation pipelines and indexes

Indexes are most valuable in `$match` and `$sort` stages, ideally placed early in the
pipeline. Once documents pass through `$unwind`, `$group`, or `$project`, indexes
generally cannot be used for subsequent stages.

```js
// Good: $match first — uses index, reduces documents flowing further
db.orders.aggregate([
  { $match: { status: "shipped" } },     // Can use index
  { $sort: { createdAt: -1 } },          // Can use the SAME compound index if it matches
  { $group: { _id: "$customerId", count: { $sum: 1 } } }
])
```

A `$sort` immediately following `$match` (no intervening stage that changes the
document set) can use the same compound index that satisfies the match, avoiding a
separate in-memory sort — a major performance win for pipelines with a `$limit` after.

## Indexing `$lookup` foreign fields

```js
// If you frequently $lookup orders by user, index orders.userId
db.orders.createIndex({ userId: 1 })

db.users.aggregate([
  { $lookup: { from: "orders", localField: "_id", foreignField: "userId", as: "orders" } }
])
```

Always index the `foreignField` used in a `$lookup` — without it, every lookup
degenerates into a collection scan on the foreign collection per input document.

## Practical guidance

1. **Index your `find()` filter fields and `sort()` fields** — that's 90% of indexing
   needs for typical apps.
2. **Don't over-index.** Every index slows down writes and uses RAM/disk. Periodically
   review with `db.collection.aggregate([{ $indexStats: {} }])` to find unused indexes.
3. **Use compound indexes over multiple single-field indexes** when queries commonly
   filter/sort on the same combination of fields — a well-designed compound index can
   satisfy several query shapes at once.
4. **Unique indexes enforce uniqueness at the database level** — don't rely solely on
   application-level checks for things like email uniqueness; race conditions can slip
   past app-level validation.
5. **TTL indexes are the standard MongoDB pattern for expiring data** (sessions,
   verification tokens, temporary caches) — cleaner than a cron job manually deleting
   old rows.