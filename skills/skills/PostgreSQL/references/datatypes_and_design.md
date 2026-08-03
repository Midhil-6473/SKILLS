# Data Types, Table Design, and Normalization

## Core data types

| Type | Use case |
|---|---|
| `INTEGER` / `BIGINT` / `SMALLINT` | Whole numbers of varying range |
| `NUMERIC(p,s)` / `DECIMAL(p,s)` | Exact fixed-point numbers — always use for money |
| `REAL` / `DOUBLE PRECISION` | Approximate floating point — never use for money |
| `TEXT` | Variable-length string, no length limit |
| `VARCHAR(n)` | Variable-length string with an enforced max length |
| `CHAR(n)` | Fixed-length, space-padded string (rarely needed) |
| `BOOLEAN` | true/false |
| `DATE` | Calendar date, no time |
| `TIME` / `TIME WITH TIME ZONE` | Time of day |
| `TIMESTAMP` / `TIMESTAMPTZ` | Date + time; **always prefer `TIMESTAMPTZ`** for anything crossing time zones |
| `UUID` | Universally unique identifier — common as a primary key alternative to serial integers |
| `JSON` / `JSONB` | Semi-structured data — see below |
| `ARRAY` (e.g. `INTEGER[]`, `TEXT[]`) | Native array columns |
| `INET` / `CIDR` | IP addresses and networks |
| `BYTEA` | Binary data |

## `JSON` vs `JSONB` — always use `JSONB`

Both accept nearly identical input, but:

- **`JSON`** stores an exact copy of the input text, preserving whitespace and key
  order, and even duplicate keys — but processing functions must re-parse it on every
  access.
- **`JSONB`** stores data in a decomposed **binary** format — slightly slower to
  input (parsing happens once, at write time) but **significantly faster to query**,
  since no reparsing is needed. `JSONB` also **supports indexing** (via GIN — see
  `indexes_and_performance.md`), which `JSON` does not.

```sql
CREATE TABLE products (
    id     INTEGER PRIMARY KEY,
    name   TEXT NOT NULL,
    attrs  JSONB   -- flexible per-product attributes
);

INSERT INTO products (id, name, attrs) VALUES
    (1, 'T-Shirt', '{"color": "blue", "sizes": ["S", "M", "L"]}');

-- Query inside the JSONB column
SELECT name FROM products WHERE attrs @> '{"color": "blue"}';
SELECT attrs->>'color' AS color FROM products;              -- extract as text
SELECT attrs->'sizes' AS sizes FROM products;                -- extract as jsonb
```

**Practical rule:** use normal columns for anything you always have and always query by
(structured, known-shape data); use `JSONB` for genuinely variable/optional attributes
you don't want to model as dozens of nullable columns or a separate EAV table.

## Arrays

```sql
CREATE TABLE articles (
    id    INTEGER PRIMARY KEY,
    title TEXT,
    tags  TEXT[]
);

INSERT INTO articles (id, title, tags) VALUES (1, 'Intro to SQL', ARRAY['sql', 'databases', 'beginner']);

SELECT title FROM articles WHERE 'sql' = ANY(tags);
SELECT title FROM articles WHERE tags && ARRAY['sql', 'nosql'];  -- overlap operator
```

## Constraints — enforcing data integrity at the database level

```sql
CREATE TABLE orders (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','shipped','completed','cancelled')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Constraint | Purpose |
|---|---|
| `PRIMARY KEY` | Uniquely identifies each row; implicitly `NOT NULL` + `UNIQUE` |
| `FOREIGN KEY` / `REFERENCES` | Enforces referential integrity to another table |
| `NOT NULL` | Column must have a value |
| `UNIQUE` | No duplicate values allowed |
| `CHECK` | Custom boolean condition every row must satisfy |
| `DEFAULT` | Value used when none is provided on insert |

### `ON DELETE` / `ON UPDATE` referential actions

```sql
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE   -- delete orders when user is deleted
user_id INTEGER REFERENCES users(id) ON DELETE SET NULL   -- null out the reference instead
user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT   -- (default) block deletion of referenced user
```

## Auto-incrementing primary keys — modern syntax

```sql
-- Modern (SQL-standard, preferred)
CREATE TABLE users (
    id GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT
);

-- Legacy (still common in older code, functionally similar)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT
);
```

`GENERATED ALWAYS AS IDENTITY` is the modern, SQL-standard-compliant way to get
auto-incrementing keys — prefer it over `SERIAL` in new schemas.

### UUID primary keys (alternative to sequential integers)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- requires the pgcrypto extension, or use uuid-ossp
    name TEXT
);
```

UUIDs are useful when IDs must be generated client-side before insertion, or when you
want to avoid leaking row counts/creation order through sequential integer IDs.

## Normalization — the relational design discipline

Unlike document databases (model for access patterns), relational design classically
starts from **normalization** — organizing tables to minimize redundancy and avoid
update anomalies.

- **1NF (First Normal Form):** each column holds atomic (indivisible) values; no
  repeating groups.
- **2NF:** no partial dependency — every non-key column depends on the *entire*
  primary key (relevant for composite keys).
- **3NF:** no transitive dependency — non-key columns depend only on the primary key,
  not on other non-key columns.

```sql
-- Un-normalized: repeats customer info on every order (update anomaly risk)
CREATE TABLE orders_denormalized (
    order_id INTEGER, customer_name TEXT, customer_email TEXT, product TEXT
);

-- Normalized: customer info lives once, referenced by orders
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), product TEXT);
```

**When to denormalize deliberately:** for read-heavy analytical workloads or
reporting tables, controlled denormalization (or materialized views — see
`functions_views_triggers.md`) can trade some redundancy for significantly faster
reads. Always start normalized, and denormalize for a measured, specific performance
reason — not by default.

## Relationships in a relational schema

- **One-to-one:** a foreign key with a `UNIQUE` constraint on the referencing column
  (e.g., `user_profile.user_id UNIQUE REFERENCES users(id)`).
- **One-to-many:** a plain foreign key on the "many" side (e.g., `orders.user_id
  REFERENCES users(id)`).
- **Many-to-many:** a separate **join table** holding foreign keys to both sides.

```sql
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT);

CREATE TABLE enrollments (
    student_id INTEGER REFERENCES students(id),
    course_id  INTEGER REFERENCES courses(id),
    PRIMARY KEY (student_id, course_id)
);
```

## Range types (a PostgreSQL specialty)

```sql
CREATE TABLE bookings (
    id INTEGER PRIMARY KEY,
    room_id INTEGER,
    during TSRANGE  -- a range of timestamps
);

INSERT INTO bookings (id, room_id, during) VALUES (1, 101, '[2026-01-01 14:00, 2026-01-01 16:00)');

-- Prevent overlapping bookings for the same room using an exclusion constraint
ALTER TABLE bookings ADD CONSTRAINT no_overlap
    EXCLUDE USING gist (room_id WITH =, during WITH &&);
```

Range types + exclusion constraints are a distinctly PostgreSQL feature useful for
scheduling, reservation, and interval-overlap problems that are awkward to express in
plain SQL elsewhere.