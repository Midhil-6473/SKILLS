# Mongoose — Schemas, Models, Validation, Middleware, Population

## What is Mongoose?

Mongoose is an **Object Data Modeling (ODM)** library for MongoDB and Node.js. It adds
a semi-rigid schema layer, validation, middleware (hooks), and convenient query/model
APIs on top of the raw MongoDB driver — the standard choice for Node.js/Express apps
working with MongoDB.

```bash
npm install mongoose
```

```js
const mongoose = require("mongoose");
await mongoose.connect("mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/myapp");
```

## Schemas — defining document structure

A **Schema** maps directly to a MongoDB collection and defines field names, types,
validation rules, defaults, instance methods, static methods, and middleware.

```js
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true },
  age: { type: Number, min: 0, max: 120 },
  role: { type: String, enum: ["admin", "user", "guest"], default: "user" },
  joinedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
});
```

### Converting a schema into a usable Model

```js
const User = mongoose.model("User", userSchema);
// Mongoose pluralizes and lowercases the model name for the collection: "users"
```

Models are responsible for all CRUD operations for their collection.

## SchemaTypes — the valid field types

| Type | Notes |
|---|---|
| `String` | Unicode text |
| `Number` | 64-bit float |
| `Date` | JS Date object, stored as ISODate |
| `Boolean` | true/false |
| `Buffer` | Binary data |
| `ObjectId` (`Schema.Types.ObjectId`) | MongoDB ObjectId, commonly used for references |
| `Array` | Array of any type |
| `Map` | Key-value pairs with typed values |
| `Mixed` (`Schema.Types.Mixed`) | Any value — loses type safety, use sparingly |
| `Decimal128` | High-precision decimal, e.g. for currency |

A SchemaType is a configuration object for a path (defaults, getters/setters,
validation) — not the same thing as the underlying JS/BSON type.

### Universal SchemaType options

```js
{
  required: true,           // boolean or function
  default: Date.now,        // value, or a function whose return value is used
  select: false,             // exclude field from default query projections
  validate: fn,               // custom validator function
}
```

### Type-specific options

```js
const productSchema = new Schema({
  title: { type: String, required: [true, "Title is required"], minlength: 3 },
  price: { type: Number, required: true, min: [0, "Price must be positive"] },
  sku: { type: String, match: /^[A-Z]{3}-\d{4}$/ },
  category: { type: String, enum: ["electronics", "books", "clothing"] },
});
```

## Relationships — references and embedding in Mongoose

### Referencing (population)

```js
const bookSchema = new Schema({
  title: String,
  author: { type: Schema.Types.ObjectId, ref: "Person" },  // Reference by _id
});
const Book = mongoose.model("Book", bookSchema);

// Populate() replaces the ObjectId with the full referenced document
const book = await Book.findOne().populate("author");
console.log(book.author.name);
```

```js
// Populate only specific fields
await Book.findOne().populate("author", "name email");

// Populate nested paths
await Order.findOne().populate({ path: "items.product", select: "name price" });
```

### Embedding (subdocuments)

```js
const addressSchema = new Schema(
  { street: String, city: { type: String, required: true }, zip: { type: String, match: /^\d{5}$/ } },
  { _id: false }  // Don't generate a separate _id for the embedded subdocument
);

const customerSchema = new Schema({ name: String, address: addressSchema });
```

## Validation

Validation runs automatically as the **first `pre('save')` hook** on every schema by
default, before a document is written.

```js
const cat = new Cat();  // no name, but name is required
try {
  await cat.save();
} catch (err) {
  console.log(err.errors["name"].message);  // "Path `name` is required."
}
```

### Built-in validators

- `required` — on every type
- Numbers: `min`, `max`
- Strings: `enum`, `match`, `minlength`, `maxlength`

### Custom validators (sync and async)

```js
const orderSchema = new Schema({
  quantity: {
    type: Number,
    validate: {
      validator: (v) => Number.isInteger(v) && v > 0,
      message: (props) => `${props.value} must be a positive integer`,
    },
  },
  couponCode: {
    type: String,
    validate: {
      validator: async function (code) {
        const Coupon = mongoose.model("Coupon");
        const coupon = await Coupon.findOne({ code });
        return !!coupon;
      },
      message: "Invalid coupon code",
    },
  },
});
```

Async validators return a Promise — Mongoose waits for it to resolve; rejection or a
resolved `false` both count as a validation failure.

### Manual validation & update validators

```js
// Manual validation without saving
const error = user.validateSync();  // or: await user.validate()

// Update operations do NOT run validators by default — opt in explicitly:
await User.updateOne({ _id }, { $set: { age: -5 } }, { runValidators: true });
```

### Disabling automatic pre-save validation

```js
schema.set("validateBeforeSave", false);
```

## Middleware (hooks / lifecycle functions)

Middleware are functions that run at specific points in a document/query lifecycle.

```js
const userSchema = new Schema({ name: String, email: String, password: String });

// pre-save hook — e.g., hash a password before saving
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// post-save hook — e.g., logging or triggering a side effect
userSchema.post("save", function (doc) {
  console.log(`User saved: ${doc._id}`);
});
```

**Types of middleware:** document middleware (`save`, `validate`, `updateOne`,
`deleteOne` called on a document instance), query middleware (`find`, `findOne`,
`updateMany`, etc. called on the Model/Query), aggregate middleware, and model
middleware (`insertMany`).

```js
schema.post(/Many$/, function (res) {
  console.log("Ran updateMany() or deleteMany()");
});
```

**Important gotcha:** document middleware for `deleteOne` is NOT executed by default
when calling `Model.deleteOne()` — only when calling `doc.deleteOne()` on a document
instance. Pass `{ document: true, query: false }` to `pre()`/`post()` options to control
exactly which context a hook applies to.

## Instance methods, statics, and virtuals

```js
// Instance method — available on documents
userSchema.methods.getFullProfile = function () {
  return `${this.name} <${this.email}>`;
};

// Static method — available on the Model itself
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email });
};

// Virtual — computed property, not stored in MongoDB
userSchema.virtual("displayName").get(function () {
  return `${this.name} (${this.role})`;
});

const user = await User.findByEmail("alice@example.com");
console.log(user.getFullProfile(), user.displayName);
```

## Full example: a Blog + User app (the canonical Mongoose pattern)

```js
// models/User.js
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
});
module.exports = mongoose.model("User", userSchema);

// models/Blog.js
const blogSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, minlength: 4 },
  content: String,
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });   // Adds createdAt/updatedAt automatically
module.exports = mongoose.model("Blog", blogSchema);

// index.js
const user = await User.create({ name: "Alice", email: "alice@example.com" });
const blog = await Blog.create({ title: "Hello World", slug: "hello-world", author: user._id });

const populated = await Blog.findById(blog._id).populate("author", "name email");
console.log(populated.author.name);  // "Alice"
```

## JSON Schema export (validation parity with server-side rules)

```js
const schema = new Schema({ name: String });
schema.toJSONSchema();
// { required: ['_id'], properties: { name: { type: ['string','null'] }, _id: { type: 'string' } } }
```

Useful when you want your Mongoose schema and MongoDB's native `$jsonSchema`
collection validator (see `data_modeling.md`) to stay in sync.

## When to use Mongoose vs. the raw driver

| | Mongoose | Raw MongoDB driver |
|---|---|---|
| Schema enforcement in app code | Built in | Manual |
| Validation | Declarative, built in | Manual |
| Middleware/hooks | Built in | Manual |
| Population (joins) | `.populate()` helper | Manual `$lookup` or app-side query |
| Performance overhead | Slightly higher (casting, validation) | Minimal |
| Best for | Most Node.js/Express apps | High-performance services, or when you want full control |