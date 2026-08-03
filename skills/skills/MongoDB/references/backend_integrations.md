# Backend Framework Integrations — Node.js, Express, Next.js & More

## Node.js — raw driver basics

```bash
npm install mongodb
```

```js
const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;
async function connectDB() {
  await client.connect();
  db = client.db("myapp");
  console.log("Connected to MongoDB");
}

module.exports = { connectDB, getDb: () => db };
```

**Connection pooling matters:** create a **single `MongoClient` instance** and reuse it
across your whole app — don't call `new MongoClient()` per request. The driver
internally manages a connection pool per client instance.

## Express.js integration

### Project structure (typical)

```
project/
├── models/
│   ├── User.js
│   └── Blog.js
├── routes/
│   ├── users.js
│   └── blogs.js
├── db.js
├── app.js
└── .env
```

### `db.js` — connection setup (Mongoose)

```js
const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

module.exports = connectDB;
```

### `app.js` — wiring it together

```js
require("dotenv").config();
const express = require("express");
const connectDB = require("./db");
const userRoutes = require("./routes/users");

const app = express();
app.use(express.json());

connectDB();

app.use("/api/users", userRoutes);

app.listen(3000, () => console.log("Server running on port 3000"));
```

### `routes/users.js` — a full CRUD REST API

```js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Create
router.post("/", async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Read all
router.get("/", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Read one
router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

// Update
router.put("/:id", async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

// Delete
router.delete("/:id", async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

module.exports = router;
```

### Error-handling middleware for Mongoose validation errors

```js
app.use((err, req, res, next) => {
  if (err.name === "ValidationError") {
    return res.status(400).json({ errors: Object.values(err.errors).map(e => e.message) });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate key", field: Object.keys(err.keyPattern)[0] });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
```

`err.code === 11000` is MongoDB's duplicate-key error code — critical to handle
explicitly since it's extremely common with `unique: true` fields.

## Next.js integration

Next.js's serverless/edge functions create a new function invocation per request in
many deployment models, so **connection reuse across invocations** is critical to
avoid exhausting your connection pool.

### App Router — `lib/mongodb.js` (cached connection pattern)

```js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  // Preserve the client across HMR reloads in dev
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production, create a new client (one per serverless instance, reused across invocations)
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
```

### Using it in a Route Handler (`app/api/users/route.js`)

```js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  const client = await clientPromise;
  const db = client.db("myapp");
  const users = await db.collection("users").find().toArray();
  return NextResponse.json(users);
}

export async function POST(request) {
  const body = await request.json();
  const client = await clientPromise;
  const db = client.db("myapp");
  const result = await db.collection("users").insertOne(body);
  return NextResponse.json(result, { status: 201 });
}
```

### With Mongoose in Next.js (cached connection to survive hot-reload/serverless reuse)

```js
// lib/dbConnect.js
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
```

```js
// app/api/users/route.js
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export async function GET() {
  await dbConnect();
  const users = await User.find();
  return Response.json(users);
}
```

**Important Next.js/Mongoose gotcha:** in dev mode with Fast Refresh, re-registering
a Mongoose model on every reload throws `OverwriteModelError`. Guard model
registration:

```js
// models/User.js
import mongoose from "mongoose";
const userSchema = new mongoose.Schema({ name: String, email: String });
export default mongoose.models.User || mongoose.model("User", userSchema);
```

### Server Components — direct data fetching (no API route needed)

```js
// app/users/page.js
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export default async function UsersPage() {
  await dbConnect();
  const users = await User.find().lean();  // .lean() for plain JS objects, faster for read-only display
  return (
    <ul>
      {users.map((u) => <li key={u._id}>{u.name}</li>)}
    </ul>
  );
}
```

`.lean()` skips Mongoose document hydration (no change tracking, no virtuals/methods)
— use it for read-only data you're just rendering, not data you plan to `.save()`.

## Other backend frameworks

### Python — Flask (with PyMongo)

```bash
pip install pymongo flask python-dotenv
```

```python
from flask import Flask, jsonify, request
from pymongo import MongoClient
import os

app = Flask(__name__)
client = MongoClient(os.environ["MONGODB_URI"])
db = client["myapp"]

@app.route("/api/users", methods=["GET"])
def get_users():
    users = list(db.users.find({}, {"_id": 0}))
    return jsonify(users)

@app.route("/api/users", methods=["POST"])
def create_user():
    result = db.users.insert_one(request.json)
    return jsonify({"insertedId": str(result.inserted_id)}), 201
```

### Python — FastAPI (with Motor, the async driver)

```bash
pip install motor fastapi uvicorn
```

```python
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
import os

app = FastAPI()
client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
db = client["myapp"]

@app.get("/api/users")
async def get_users():
    users = await db.users.find({}, {"_id": 0}).to_list(length=100)
    return users

@app.post("/api/users", status_code=201)
async def create_user(user: dict):
    result = await db.users.insert_one(user)
    return {"insertedId": str(result.inserted_id)}
```

FastAPI + Motor is the standard async-native pairing for Python + MongoDB — use this
over Flask/PyMongo (sync) for high-concurrency APIs.

### Python — Django (via djongo or MongoEngine)

Django's ORM is fundamentally relational; the two common approaches:
- **MongoEngine** — a Mongoose-like ODM for Django/Python, define `Document` classes
  similarly to Mongoose schemas.
- Use MongoDB as a secondary/analytics store alongside a relational primary DB, rather
  than forcing Django's ORM onto MongoDB.

```python
# MongoEngine example
from mongoengine import Document, StringField, IntField, connect

connect(host=os.environ["MONGODB_URI"])

class User(Document):
    name = StringField(required=True)
    email = StringField(required=True, unique=True)
    age = IntField(min_value=0)

user = User(name="Alice", email="alice@example.com", age=30)
user.save()
```

### Java — Spring Boot (with Spring Data MongoDB)

```java
// build.gradle: implementation 'org.springframework.boot:spring-boot-starter-data-mongodb'

@Document(collection = "users")
public class User {
    @Id
    private String id;
    private String name;
    private String email;
    // getters/setters
}

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
}

@RestController
@RequestMapping("/api/users")
public class UserController {
    @Autowired
    private UserRepository userRepository;

    @PostMapping
    public User create(@RequestBody User user) {
        return userRepository.save(user);
    }

    @GetMapping
    public List<User> getAll() {
        return userRepository.findAll();
    }
}
```

```properties
# application.properties
spring.data.mongodb.uri=${MONGODB_URI}
```

Spring Data MongoDB's repository pattern (`MongoRepository`) auto-generates CRUD
methods and supports derived query methods (`findByEmail`) purely from method naming
conventions — no manual query-writing needed for common cases.

## Universal integration principles (framework-agnostic)

1. **One client/connection instance per app process**, reused across requests — never
   reconnect per request.
2. **Connection string via environment variable**, never hardcoded.
3. **Handle duplicate-key errors (code 11000)** explicitly wherever `unique` indexes
   exist.
4. **Use the async-native driver/ODM** where your framework is async (Motor for
   FastAPI, Mongoose's promise-based API for Node) rather than blocking calls.
5. **Validate at the API boundary too** — Mongoose/MongoEngine validation is not a
   substitute for request-body validation (e.g., with `zod`, `joi`, or Pydantic) if
   you want clean error messages before hitting the DB layer at all.
6. **In serverless environments (Next.js API routes, AWS Lambda), cache the
   connection** across invocations using the `global`-scoped pattern shown above —
   otherwise you exhaust Atlas's connection limit under load.