# CRUD Operations — Create, Read, Update, Delete

CRUD operations are the core interaction MongoDB provides: Create, Read, Update, Delete.
Examples below use `mongosh` syntax; equivalent methods exist in every driver
(Node.js, Python, etc. — see `backend_integrations.md`).

## Create (Insert)

```js
// Insert a single document
db.users.insertOne({ name: "Alice", email: "alice@example.com", age: 30 })

// Insert multiple documents
db.users.insertMany([
  { name: "Bob", email: "bob@example.com", age: 25 },
  { name: "Carol", email: "carol@example.com", age: 35 },
])
```

If the target collection doesn't exist, MongoDB creates it automatically on first
insert (no `createCollection` required, though you can call it explicitly to set
options like validation rules or capped size upfront).

## Read (Query)

```js
// Find all documents
db.users.find()

// Find with a filter
db.users.find({ age: { $gt: 28 } })

// Find one document
db.users.findOne({ email: "alice@example.com" })

// Projection — return only specific fields
db.users.find({ age: { $gt: 28 } }, { name: 1, email: 1, _id: 0 })

// Sort, limit, skip (pagination)
db.users.find().sort({ age: -1 }).limit(10).skip(20)
```

### Common query operators

| Operator | Meaning |
|---|---|
| `$eq`, `$ne` | Equals / not equals |
| `$gt`, `$gte`, `$lt`, `$lte` | Greater/less than (or equal) |
| `$in`, `$nin` | Value in / not in array |
| `$and`, `$or`, `$nor` | Logical combinators |
| `$exists` | Field exists (or doesn't) |
| `$regex` | Pattern match |
| `$elemMatch` | Match array elements against multiple criteria |
| `$all` | Array contains all specified values |
| `$size` | Array has exact length |

```js
db.products.find({
  $or: [ { category: "electronics" }, { price: { $lt: 20 } } ]
})

db.products.find({ tags: { $elemMatch: { $eq: "sale" } } })
```

## Update

```js
// Update a single document
db.users.updateOne(
  { email: "alice@example.com" },
  { $set: { age: 31 } }
)

// Update many documents
db.users.updateMany(
  { age: { $lt: 18 } },
  { $set: { isMinor: true } }
)

// Replace an entire document (except _id)
db.users.replaceOne({ email: "alice@example.com" }, { name: "Alice", email: "alice@example.com", age: 31 })

// Upsert — insert if no match found
db.users.updateOne(
  { email: "dave@example.com" },
  { $set: { name: "Dave", age: 40 } },
  { upsert: true }
)
```

### Common update operators

| Operator | Meaning |
|---|---|
| `$set` | Set field value(s) |
| `$unset` | Remove a field |
| `$inc` | Increment/decrement a numeric field |
| `$push` | Append to an array |
| `$pull` | Remove matching elements from an array |
| `$addToSet` | Add to array only if not already present |
| `$rename` | Rename a field |

```js
db.products.updateOne(
  { sku: "ABC123" },
  { $inc: { stock: -1 }, $push: { history: { action: "sold", date: new Date() } } }
)
```

## Delete

```js
db.users.deleteOne({ email: "dave@example.com" })
db.users.deleteMany({ age: { $lt: 13 } })
```

## Bulk writes (efficient batch operations)

```js
db.users.bulkWrite([
  { insertOne: { document: { name: "Eve", age: 22 } } },
  { updateOne: { filter: { name: "Bob" }, update: { $set: { age: 26 } } } },
  { deleteOne: { filter: { name: "Carol" } } },
])
```

Use bulk writes for batching many operations in a single round trip — significantly
faster than looping individual calls in application code.

## Find and modify atomically

```js
// Atomically find, update, and return either the old or new document
db.users.findOneAndUpdate(
  { email: "alice@example.com" },
  { $inc: { age: 1 } },
  { returnDocument: "after" }
)

db.users.findOneAndDelete({ email: "dave@example.com" })
```

Useful for patterns like atomic counters, job queues (claim-and-process), and any
read-modify-write that must not race with concurrent requests.