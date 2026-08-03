# Data Modeling — Schema Design, Embedding vs Referencing

## The core principle: model for your access patterns

Unlike relational database normalization (minimize redundancy above all else), MongoDB
schema design starts from a different question:

> **"What does my application need to read and write, and how often?"**

The "correct" schema for the same data can differ completely depending on whether your
app reads a user's orders constantly (embed them) or writes to orders independently at
high volume (reference them). There's no universal right answer without knowing the
access pattern.

## Embedding vs. Referencing

### Embedding — nest related data directly in the parent document

```json
{
  "_id": "ObjectId(...)",
  "name": "Alice",
  "address": { "street": "123 Main St", "city": "Springfield" },
  "orders": [
    { "product": "Widget", "qty": 2, "date": "2026-01-01" },
    { "product": "Gadget", "qty": 1, "date": "2026-02-15" }
  ]
}
```

**Use embedding when:**
- The nested data is only ever accessed together with the parent (one query gets
  everything the page needs — no `$lookup` or app-side join)
- The nested data has a bounded, small size (a user's shipping address, a blog post's
  comments if capped)
- The nested data doesn't need to be queried/updated independently at scale
- "Contains" relationships — a blog post contains its embedded tags, an order contains
  its embedded line items

**Avoid embedding when:**
- The array is unbounded and could grow very large (e.g., embedding *all* of a
  popular user's followers directly — this can hit the 16MB document size limit and
  degrades write performance as the document grows)
- Multiple parents need to reference the same nested entity independently (duplication
  becomes an update-consistency problem)

### Referencing — store just an `_id`, join manually via `$lookup` or app code

```json
// users collection
{ "_id": "user123", "name": "Alice" }

// orders collection
{ "_id": "order456", "userId": "user123", "product": "Widget", "qty": 2 }
```

**Use referencing when:**
- The referenced data is large, grows unboundedly, or is frequently updated
  independently of the parent (e.g., a product catalog referenced by many orders)
- Many-to-many relationships where embedding would cause massive duplication
- You need to query/update the "child" entity on its own frequently

```js
// Manual join via $lookup (aggregation)
db.orders.aggregate([
  { $match: { _id: "order456" } },
  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } }
])
```

### The hybrid approach — extended reference

Store a reference **plus** a denormalized snapshot of frequently-needed fields, to
avoid a join for the common case while keeping the source of truth separate:

```json
{
  "_id": "order456",
  "userId": "user123",
  "userSnapshot": { "name": "Alice", "email": "alice@example.com" },
  "product": "Widget"
}
```

Trade-off: `userSnapshot` can go stale if the user updates their name — decide
explicitly whether that's acceptable for your use case (often fine for historical
records like invoices; not fine for live profile data).

## Common schema design patterns

| Pattern | What it solves |
|---|---|
| **Subset pattern** | Embed only the most-recently-accessed subset of a large array (e.g., last 10 reviews) in the parent; keep the full set in a separate collection referenced by `_id`. |
| **Bucket pattern** | Group time-series-like data into time-bucketed documents (e.g., one document per sensor per hour) instead of one document per reading — reduces document count and index overhead. |
| **Computed pattern** | Pre-compute and store expensive aggregate values (e.g., `totalOrders`, `avgRating`) on the parent document, updated incrementally, to avoid recomputing on every read. |
| **Schema versioning pattern** | Add a `schemaVersion` field to documents so your app can handle multiple document shapes during a gradual migration, instead of a blocking one-shot migration. |
| **Polymorphic pattern** | Store different "shapes" of related entities in the same collection (e.g., different product types with different attribute sets), relying on MongoDB's flexible schema instead of separate tables per type. |
| **Attribute pattern** | For documents with many optional/sparse fields, store them as an array of `{k, v}` pairs instead of top-level fields — makes indexing sparse attributes easier. |

## Relationships: one-to-one, one-to-many, many-to-many

- **One-to-one:** usually embed (e.g., user + their single profile settings object).
- **One-to-few:** embed as an array (e.g., a few shipping addresses per user).
- **One-to-many (unbounded):** reference — the "many" side stores a reference back to
  the "one" (e.g., `orders.userId` referencing `users._id`).
- **Many-to-many:** typically reference in both directions, or use a join
  collection, depending on query patterns. Consider whether one side is queried far
  more often than the other — you can favor embedding on that side.

## Schema validation (enforcing structure when you want it)

MongoDB supports optional **JSON Schema-based validation** at the collection level —
useful when you want some rigidity without going fully relational:

```js
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email"],
      properties: {
        name: { bsonType: "string" },
        email: { bsonType: "string", pattern: "^.+@.+$" },
        age: { bsonType: "int", minimum: 0 },
      },
    },
  },
  validationLevel: "strict",    // or "moderate" (only validates new/modified docs)
  validationAction: "error",    // or "warn" (logs but allows the write)
})
```

This is server-side validation independent of any ODM (Mongoose) validation running in
application code — the two can be used together for defense in depth.

## Document size limit

Every BSON document has a hard **16MB size limit**. This is a major reason to avoid
unboundedly embedding — a user with 100,000 followers embedded directly would blow
past this limit long before reaching that scale. Use referencing or the bucket pattern
for anything that grows without bound.

## Practical workflow for designing a schema

1. List your application's actual queries and their frequency ("get user + their last
   10 orders" happens on every page load; "get all orders for analytics" happens once a
   day in a batch job).
2. For each relationship, ask: is the "many" side bounded and always accessed together
   with the "one" side? → embed. Is it unbounded or needs independent access? → reference.
3. Add indexes matching your most frequent queries (see `indexes.md`).
4. Add JSON Schema validation for critical invariants if you want DB-level enforcement.
5. Revisit as access patterns change — MongoDB's flexible schema means you *can* evolve
   this without a blocking migration, unlike most relational schema changes.