# Aggregation Pipeline — Stages, Operators, Optimization

## What is the aggregation pipeline?

A framework for processing data through a sequence of **stages**, where each stage
transforms documents and passes the output to the next stage — conceptually similar to
Unix pipes, or SQL's `GROUP BY`/`JOIN` but far more composable. Documents flow through
stages sequentially: `Collection → $match → $group → $sort → $project → Results`.

```js
db.orders.aggregate([
  { $match: { status: "completed" } },                       // Stage 1: filter
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } }, // Stage 2: group + sum
  { $sort: { total: -1 } },                                  // Stage 3: sort
  { $limit: 10 },                                            // Stage 4: top 10
])
```

`aggregate()` doesn't modify the source collection unless the pipeline explicitly
contains `$merge` or `$out`.

## Core stages

### `$match` — filter (like SQL `WHERE`)

```js
db.orders.aggregate([
  { $match: { status: "completed", orderDate: { $gte: new Date("2026-01-01") } } }
])

db.orders.aggregate([
  { $match: { $or: [ { priority: "high" }, { total: { $gt: 1000 } } ] } }
])
```

**Always place `$match` as early as possible** — it limits the total documents
flowing into the rest of the pipeline, and if placed first, can use an index just like
a regular `find()`.

### `$group` — aggregate by key (like SQL `GROUP BY`)

```js
db.orders.aggregate([
  { $group: {
      _id: "$customerId",
      totalOrders: { $sum: 1 },
      totalSpent: { $sum: "$amount" },
      avgOrderValue: { $avg: "$amount" },
      maxOrder: { $max: "$amount" },
      minOrder: { $min: "$amount" },
      firstOrder: { $first: "$orderDate" },
      products: { $push: "$product" },        // Array of all values (with duplicates)
      uniqueProducts: { $addToSet: "$product" }, // Array of unique values
  }}
])

// Group by multiple fields
db.orders.aggregate([
  { $group: { _id: { year: { $year: "$orderDate" }, month: { $month: "$orderDate" } }, count: { $sum: 1 } } }
])
```

Use `_id: null` to aggregate across the entire collection into one summary document.

### `$sort`, `$limit`, `$skip`

```js
db.orders.aggregate([ { $sort: { total: -1 } }, { $skip: 20 }, { $limit: 10 } ])
```

### `$project` — reshape output fields

```js
db.movies.aggregate([
  { $project: { title: 1, year: 1, rating: 1, _id: 0 } }   // include only these
])
```

`$project` should typically be the **last** stage, used to shape the client-facing
response. Using it early/mid-pipeline to drop fields rarely helps — MongoDB already
optimizes to use only the fields subsequent stages need.

### `$lookup` — join with another collection (like SQL `JOIN`)

```js
// Basic equality join
db.orders.aggregate([
  { $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user",
  }}
])
```

```js
// Correlated subquery syntax — more complex join conditions
db.movies.aggregate([
  { $lookup: {
      from: "comments",
      let: { movieId: "$_id", movieYear: "$year" },
      pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ["$movie_id", "$$movieId"] },
          { $gt: ["$year", "$$movieYear"] },
        ]}}}
      ],
      as: "laterComments",
  }}
])
```

**Always index the `foreignField`** in the joined collection — otherwise `$lookup`
degenerates to a per-document collection scan.

### `$unwind` — flatten an array field into separate documents

```js
db.products.aggregate([
  { $unwind: "$tags" },
  { $match: { tags: "electronics" } }
])
```

Note: indexes generally can't be used *after* `$unwind` — only the initial `$match`
before it benefits from an index.

### `$addFields` / `$set` — add or compute new fields without dropping existing ones

```js
db.orders.aggregate([
  { $addFields: { totalWithTax: { $multiply: ["$amount", 1.08] } } }
])
```

### `$count`

```js
db.orders.aggregate([ { $match: { status: "completed" } }, { $count: "completedOrders" } ])
```

### `$facet` — run multiple sub-pipelines in parallel, combine results

```js
db.products.aggregate([
  { $facet: {
      byCategory: [ { $group: { _id: "$category", count: { $sum: 1 } } } ],
      priceStats: [ { $group: { _id: null, avg: { $avg: "$price" }, max: { $max: "$price" } } } ],
  }}
])
```

Useful for building a single dashboard/report query that would otherwise require
multiple round trips.

## Expression syntax

Aggregation expressions use `$fieldName` to reference document fields, and operators
like `$add`, `$multiply`, `$concat`, `$dateToString` for computed values:

```js
{ $addFields: { fullPrice: { $add: [3, "$inventory.total"] } } }
```

## Optimization checklist

1. **`$match` first** whenever possible — enables index usage and shrinks the working
   set immediately.
2. **`$sort` immediately after `$match`** (no stage in between that changes the
   document set) lets MongoDB reuse the same compound index for both, avoiding an
   in-memory sort.
3. **Index the fields used in `$match`, `$sort`, and `$lookup.foreignField`.**
4. **Avoid `$project` early** unless it measurably reduces payload before an expensive
   `$lookup` — the query planner already optimizes field usage automatically in most
   cases.
5. **Use `explain("executionStats")`** on your aggregation to confirm `IXSCAN` (index
   scan) rather than `COLLSCAN` (collection scan) is happening at each relevant stage.
6. **`allowDiskUse: true`** if a `$group`/`$sort` stage needs more than the default
   in-memory limit (100MB) — necessary for large aggregations, with a performance cost.

```js
db.orders.aggregate([...], { allowDiskUse: true })
db.orders.explain("executionStats").aggregate([
  { $match: { status: "shipped" } },
  { $sort: { createdAt: -1 } },
])
```

## When to use aggregation vs. plain `find()`

| Need | Use |
|---|---|
| Simple filter/sort/paginate | `find()` |
| Grouping, summing, averaging across documents | Aggregation `$group` |
| Joining data from another collection | Aggregation `$lookup` |
| Reshaping documents for a report/dashboard | Aggregation `$project`/`$facet` |
| Computing derived fields | Aggregation `$addFields` |