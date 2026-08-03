# Transactions, Replication, Sharding & Production Operations

## Multi-document transactions

MongoDB supports multi-document ACID transactions — run multiple read/write operations
as a single all-or-nothing event, even across a sharded cluster.

```js
const session = client.startSession();
try {
  session.startTransaction();
  const orders = client.db("myapp").collection("orders");
  const inventory = client.db("myapp").collection("inventory");

  await orders.insertOne({ product: "Widget", qty: 2 }, { session });
  await inventory.updateOne({ product: "Widget" }, { $inc: { stock: -2 } }, { session });

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

With Mongoose:

```js
const session = await mongoose.startSession();
session.startTransaction();
try {
  await Order.create([{ product: "Widget", qty: 2 }], { session });
  await Inventory.updateOne({ product: "Widget" }, { $inc: { stock: -2 } }, { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

**When to actually use transactions:** only when an operation *must* be atomic across
multiple documents/collections (e.g., debit one account, credit another). For most
single-document updates, MongoDB's native atomicity per document (already
guaranteed without transactions) is sufficient and faster — don't reach for
transactions by default.

## Replication — high availability

A **replica set** is a group of MongoDB servers maintaining the same data set, providing
redundancy and high availability:

- One **primary** node accepts all writes
- One or more **secondary** nodes replicate the primary's data (asynchronously by
  default) and can serve reads if configured
- If the primary becomes unavailable, the replica set automatically holds an election
  and promotes a secondary to primary — **automatic failover**, minimizing downtime

Atlas clusters are backed by replica sets by default (even the M0 free tier runs a
3-node replica set behind the scenes) — you get this durability without configuring
anything yourself.

### Read preferences (controlling where reads go)

```js
db.collection.find().readPref("secondaryPreferred")
```

| Read preference | Behavior |
|---|---|
| `primary` (default) | Always read from primary — strongest consistency |
| `primaryPreferred` | Primary if available, else a secondary |
| `secondary` | Always read from a secondary — reduces load on primary, may read slightly stale data |
| `secondaryPreferred` | Secondary if available, else primary |
| `nearest` | Lowest network latency node, regardless of role |

## Sharding — horizontal scaling

**Sharding** partitions data across multiple machines (shards) when a single server
can no longer handle the data volume or throughput. MongoDB automatically distributes
data based on a **shard key**.

Key concepts:
- **Shard key** — the field(s) MongoDB uses to distribute documents across shards.
  Choosing a good shard key is one of the most consequential decisions in a sharded
  deployment — poor choices cause "hot shards" that receive disproportionate traffic.
- **Zone sharding** — define geographical zones to control where documents physically
  live based on shard key ranges (e.g., EU user data stays on EU-based shards for
  data-residency compliance).
- **Shard key refinement** — you can refine (add fields to) a shard key as your
  application evolves, without a full re-shard from scratch.

**When to shard:** only once a single replica set's storage or throughput capacity is
genuinely insufficient — sharding adds real operational complexity, so it's a "scale
when you need it," not a default starting architecture.

## Change Streams — reacting to data changes in real time

```js
const changeStream = db.collection("orders").watch();
changeStream.on("change", (change) => {
  console.log("Change detected:", change.operationType, change.fullDocument);
});
```

Change streams let applications subscribe to real-time data changes (inserts, updates,
deletes) without polling — the backbone of features like live dashboards,
notifications, and cache invalidation. Built on the replication oplog internally.

## Time series collections

Purpose-built collection type for storing high-volume timestamped measurement data
(IoT sensors, financial ticks, metrics) with automatic storage optimizations:

```js
db.createCollection("sensorReadings", {
  timeseries: { timeField: "timestamp", metaField: "sensorId", granularity: "seconds" },
})
```

## Production checklist

1. **Use replica sets (or Atlas, which provides them by default)** — never run a
   single standalone `mongod` in production.
2. **Choose your shard key carefully before sharding** — changing a poor shard key
   later is costly; model your access patterns first (see `data_modeling.md`).
3. **Set appropriate read/write concerns** — `w: "majority"` for durability-critical
   writes; understand the durability/performance trade-off of weaker concerns.
4. **Enable authentication and role-based access control** — never run MongoDB without
   auth, even internally. Atlas enforces this by requiring a database user by default.
5. **Set up automated backups** — available from Atlas M10+; for self-managed
   deployments, configure `mongodump`/point-in-time oplog-based backups.
6. **Monitor with the Atlas UI (or your own metrics pipeline)** — watch connection
   counts, replication lag, slow queries, and disk usage proactively.
7. **Right-size read preferences** — route non-critical, tolerant-of-staleness reads
   to secondaries to reduce primary load, but understand you're trading consistency for
   throughput.
8. **Test failover** — understand your driver's retry behavior (`retryWrites=true` is
   the modern Atlas default) so your app degrades gracefully during an election.
9. **Review the official Development Checklist** at
   `mongodb.com/docs/manual/administration/production-checklist-development/` before
   shipping — it covers schema design, connection pool sizing, and index review as a
   pre-launch gate.