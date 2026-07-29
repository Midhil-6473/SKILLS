# MongoDB Atlas — Account, Organizations, Clusters, Connection

## What is Atlas?

**MongoDB Atlas** is MongoDB's fully-managed, multi-cloud Database-as-a-Service. It
runs MongoDB for you on AWS, Google Cloud, or Azure, handling provisioning, patching,
backups, and scaling, and adds integrated services: full-text Search, Vector Search,
and Stream Processing. Most new MongoDB projects should start on Atlas rather than
self-hosting.

## Step 1 — Create an Atlas account

Go to `mongodb.com/cloud/atlas/register`. You can register with:
- Email address (requires email verification)
- Google account
- GitHub account (requires a public email address on your GitHub profile — Atlas
  errors if you try to register without one)

No credit card is required for the free tier.

## Step 2 — Organizations and Projects

After registering, Atlas prompts you to create an **Organization** and a **Project**.

- **Organization** — the top-level container. Group and manage users/teams and grant
  them access across one or more Projects. Security controls can be implemented at
  this level.
- **Project** — contains actual resources: database clusters, triggers, data lakes. A
  common pattern is one project per environment (`dev`, `staging`, `prod`).

You can accept the auto-created defaults or set these up manually.

## Step 3 — Deploy your first cluster (free tier)

Atlas offers three cluster types:

| Type | Description |
|---|---|
| **Shared (M0/M2/M5)** | Free (M0) or low-cost shared infrastructure — ideal for learning and small projects |
| **Dedicated** | Production workloads with dedicated, customizable resources (M10+) |
| **Serverless / Flex** | Pay-per-operation, scales automatically with variable workloads |

### Deploying an M0 free cluster (step by step)

1. Click **"Build a Database"** (or **"Create"**) from your project.
2. Select **Free (M0 Shared)**.
3. Choose a **cloud provider** (AWS, Google Cloud, or Azure) — Atlas shows only regions
   that support free clusters.
4. Choose a **region** close to your users/application for lowest latency.
5. Name your cluster (default is `Cluster0`). **You cannot rename a cluster after
   creation.** Max 64 characters, ASCII letters/numbers/hyphens only.
6. Click **Create Deployment / Create Cluster**.
7. Provisioning takes roughly 1–3 minutes (often under 15 seconds for M0).

**M0 free tier specs:** 512 MB storage, shared RAM/vCPU, no time limit — permanently
free, no credit card required. Great for learning, prototyping, small apps, and demos.

## Step 4 — Security Quickstart (appears automatically after cluster creation)

### Create a database user

```
Username: myapp-user
Password: <Atlas can auto-generate a secure one — copy it now>
```
Click **Create Database User**. This is separate from your Atlas login — it's the
credential your *application* uses to connect to the database.

### Configure network access (IP allowlist)

- For local development: click **"Add My Current IP Address"**.
- For quick prototyping only: `0.0.0.0/0` allows access from anywhere — **never use
  this in production**. Restrict to known IPs, or use VPC Peering/PrivateLink for
  production deployments.

Click **Finish and Close**.

## Step 5 — Get your connection string

1. Click **Connect** on your cluster.
2. Choose **Drivers**.
3. Select your driver (Node.js, Python, Java, etc.) and version.
4. Copy the connection string:

```
mongodb+srv://myapp-user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

5. Replace `<password>` with your actual database user password (remove the angle
   brackets too).

**Always store this in an environment variable — never hardcode it in source control:**

```bash
# .env
MONGODB_URI=mongodb+srv://myapp-user:REALPASSWORD@cluster0.xxxxx.mongodb.net/myapp?retryWrites=true&w=majority
```

## Step 6 — Verify the connection

### Using `mongosh`

```bash
mongosh "mongodb+srv://myapp-user:<password>@cluster0.xxxxx.mongodb.net/"
show dbs
use myapp
db.users.insertOne({ name: "Test User", email: "test@example.com" })
db.users.findOne()
```

### Using Node.js (raw driver)

```js
const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas!");
    const db = client.db("myapp");
    const users = db.collection("users");
    const result = await users.insertOne({ name: "Test User", email: "test@example.com" });
    console.log("Inserted:", result.insertedId);
  } finally {
    await client.close();
  }
}
main().catch(console.error);
```

### Using Mongoose

```js
const mongoose = require("mongoose");
await mongoose.connect(process.env.MONGODB_URI);
```

## MongoDB Compass — connecting the GUI

Download Compass, open it, paste the same connection string, and click **Connect**.
Browse collections visually, run queries, and inspect indexes without writing shell
commands — excellent for beginners and for debugging.

## Loading sample datasets

Atlas lets you one-click load sample datasets (e.g., `sample_mflix` for movies,
`sample_analytics`) directly from the UI — useful for practicing queries and
aggregation pipelines without needing your own data first.

## Atlas CLI (for scripting/automation)

```bash
# Install (macOS example)
brew install mongodb-atlas-cli

# Authenticate
atlas auth login

# List clusters
atlas clusters list

# Get a connection string
atlas clusters connectionStrings describe Cluster0
```

The Atlas Administration API also supports creating clusters programmatically —
`POST` to the clusters endpoint with `instanceSize: "M0"` for a free cluster, useful
for infrastructure-as-code workflows.

## Atlas UI features worth knowing

| Feature | What it does |
|---|---|
| **Browse Collections** | View/edit documents in a visual interface |
| **Atlas Search** | Full-text search indexes (available even on M0 with limitations) |
| **Atlas Vector Search** | Semantic/vector search for AI/RAG apps (see `search_and_ai.md`) |
| **Performance Advisor** | Index recommendations based on real query patterns (M10+) |
| **Real-Time Performance Panel** | Live operation rates and connection monitoring |
| **Triggers** | Serverless functions that run on database events (inserts, updates, schedules) |
| **Charts** | Build dashboards directly from your Atlas data |

## Pricing tiers overview (as a rough mental model, always verify current pricing)

| Tier | Use case | Approx. cost |
|---|---|---|
| **M0** | Learning, prototyping | Free forever, 512 MB storage |
| **Flex** | Small production / variable workloads | ~$8–30/month |
| **Dedicated (M10+)** | Production, dedicated resources, backups, VPC peering | Starts ~$0.08/hr |
| **Serverless** | Pay strictly per operation | ~$0.10/million reads, ~$1/million writes + storage |

## Production checklist before going live on Atlas

1. Upgrade from M0 to at least M10 for dedicated resources, automated backups, and SLAs.
2. Restrict Network Access to specific IPs or use VPC Peering/PrivateLink — never leave
   `0.0.0.0/0` open in production.
3. Use environment variables/secrets managers for connection strings, never hardcode.
4. Enable automated backups and understand your point-in-time recovery window.
5. Set up monitoring/alerts (Atlas has built-in alerting for connection spikes, slow
   queries, disk usage, etc.).
6. Review the Performance Advisor's index recommendations regularly.