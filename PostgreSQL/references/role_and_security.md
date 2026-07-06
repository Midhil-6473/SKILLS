# Roles, Permissions, and Security

## Roles — PostgreSQL's unified concept for users and groups

PostgreSQL uses **roles** to manage database access — a single concept that covers
both "users" (roles that can log in) and "groups" (roles used to bundle permissions).

```sql
-- Create a login-capable role (a "user")
CREATE ROLE app_user WITH LOGIN PASSWORD 'secure_password';

-- Create a group role (no login, just a permission bundle)
CREATE ROLE read_only;

-- Add app_user to the read_only group
GRANT read_only TO app_user;
```

```sql
-- Shorthand for a login role (equivalent to CREATE ROLE ... WITH LOGIN)
CREATE USER app_user WITH PASSWORD 'secure_password';
```

## Privileges — `GRANT` and `REVOKE`

```sql
-- Grant specific privileges on a table
GRANT SELECT, INSERT, UPDATE ON orders TO app_user;
GRANT ALL PRIVILEGES ON orders TO app_admin;

-- Grant on all tables in a schema (useful for setup scripts)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_only;

-- Grant usage on a schema (required before table-level grants work)
GRANT USAGE ON SCHEMA public TO app_user;

-- Revoke
REVOKE INSERT ON orders FROM app_user;
```

| Privilege | Applies to |
|---|---|
| `SELECT` | Read rows |
| `INSERT` | Add rows |
| `UPDATE` | Modify existing rows |
| `DELETE` | Remove rows |
| `TRUNCATE` | Empty a table entirely |
| `REFERENCES` | Create foreign keys referencing this table |
| `EXECUTE` | Call a function |
| `USAGE` | Use a schema, sequence, or type |

## Principle of least privilege

**Never connect application code as a superuser.** Create a scoped role with only the
privileges the application actually needs:

```sql
CREATE ROLE api_service WITH LOGIN PASSWORD 'strong_password';
GRANT USAGE ON SCHEMA public TO api_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, orders, products TO api_service;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_service;  -- needed for GENERATED/SERIAL columns
```

Reserve superuser (`postgres` role, or any role with `SUPERUSER`) for administrative
tasks, migrations, and setup scripts — not for the everyday application connection.

## Default privileges for future objects

```sql
-- Ensures NEW tables created by admin_user automatically grant SELECT to read_only
ALTER DEFAULT PRIVILEGES FOR ROLE admin_user IN SCHEMA public
    GRANT SELECT ON TABLES TO read_only;
```

Without this, `GRANT ... ON ALL TABLES` only applies to *existing* tables at the time
you run it — new tables created later won't automatically inherit the grant.

## Row-Level Security (RLS) — PostgreSQL's fine-grained access control

RLS lets you restrict which **rows** a role can see or modify, not just which tables —
essential for multi-tenant applications where different users/tenants share the same
table.

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = current_setting('app.current_tenant_id')::INTEGER);
```

The application sets `app.current_tenant_id` per connection/session (e.g.,
`SET app.current_tenant_id = '42'`), and PostgreSQL automatically filters every query
against `orders` to only that tenant's rows — enforced at the database level, not
just in application code, closing off a whole class of "forgot the WHERE clause"
security bugs.

```sql
-- Separate policies for different operations
CREATE POLICY select_own_orders ON orders FOR SELECT
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

CREATE POLICY insert_own_orders ON orders FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);
```

This is a genuinely distinguishing PostgreSQL feature — the underlying mechanism
behind multi-tenant security in platforms like Supabase (see `hosting_and_ai.md`).

## Authentication — `pg_hba.conf`

Server-level authentication rules (which hosts/users can connect, and how) are
configured in `pg_hba.conf`. Common authentication methods:

| Method | Description |
|---|---|
| `trust` | No password required — **local development only, never production** |
| `password` / `md5` | Password-based, `md5` hashes it (legacy) |
| `scram-sha-256` | Modern, secure password hashing — **preferred default** |
| `cert` | Client SSL certificate authentication |
| `peer` / `ident` | OS-level user identity matching (local connections) |

On managed platforms (Supabase, RDS, Neon), this is handled for you — relevant mainly
for self-managed PostgreSQL installations.

## SSL/TLS connections

```
# Connection string requiring SSL
postgresql://user:password@host:5432/dbname?sslmode=require
```

`sslmode=require` (or stricter: `verify-ca`, `verify-full`) should be the default for
any connection over an untrusted network — most managed Postgres providers enforce
this already.

## Practical security checklist

1. **Never use the default `postgres` superuser role for application connections.**
2. **Use `scram-sha-256` for password authentication**, not the legacy `md5`.
3. **Enable Row-Level Security on any multi-tenant table** — don't rely solely on
   application-layer `WHERE tenant_id = ...` filters, which are one missed clause away
   from a data leak.
4. **Grant only the specific privileges/tables a role needs** — avoid blanket
   `GRANT ALL` except for trusted admin roles.
5. **Store credentials in environment variables or a secrets manager**, never in
   source control.
6. **Require SSL/TLS** for any connection over a network you don't fully control.
7. **Audit roles periodically** — `\du` in `psql` lists all roles and their
   attributes; remove unused or overly-privileged roles.