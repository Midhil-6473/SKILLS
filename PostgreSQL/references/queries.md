# SQL Queries — SELECT, JOINs, Subqueries, CTEs, Window Functions

## Basic SELECT

```sql
SELECT name, email FROM users;
SELECT * FROM users WHERE age > 25 ORDER BY name ASC LIMIT 10 OFFSET 20;
SELECT DISTINCT status FROM orders;
```

## Filtering — `WHERE` operators

```sql
SELECT * FROM orders WHERE amount BETWEEN 100 AND 500;
SELECT * FROM orders WHERE status IN ('shipped', 'completed');
SELECT * FROM users WHERE email LIKE '%@gmail.com';       -- pattern match
SELECT * FROM users WHERE email ILIKE '%@GMAIL.com';      -- case-insensitive
SELECT * FROM users WHERE deleted_at IS NULL;
SELECT * FROM orders WHERE status = 'pending' AND amount > 100;
SELECT * FROM orders WHERE status = 'cancelled' OR amount < 10;
```

## Joins — the relational way to combine tables

```sql
-- INNER JOIN: only rows with matches in both tables
SELECT u.name, o.product
FROM users u
INNER JOIN orders o ON u.id = o.user_id;

-- LEFT JOIN: all rows from the left table, matched rows from the right (NULL if no match)
SELECT u.name, o.product
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;

-- RIGHT JOIN: mirror of LEFT JOIN
-- FULL OUTER JOIN: all rows from both sides, matched where possible
SELECT u.name, o.product
FROM users u
FULL OUTER JOIN orders o ON u.id = o.user_id;

-- Self-join: joining a table to itself (e.g., employees and their managers)
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```

| Join type | Returns |
|---|---|
| `INNER JOIN` | Only rows matching in both tables |
| `LEFT JOIN` | All left rows + matches from right (NULL if none) |
| `RIGHT JOIN` | All right rows + matches from left (NULL if none) |
| `FULL OUTER JOIN` | All rows from both sides |
| `CROSS JOIN` | Cartesian product — every row from A paired with every row from B |

## Aggregate functions and `GROUP BY`

```sql
SELECT status, COUNT(*) AS order_count, SUM(amount) AS total, AVG(amount) AS avg_amount
FROM orders
GROUP BY status;

-- HAVING filters groups (WHERE filters rows before grouping)
SELECT user_id, SUM(amount) AS total_spent
FROM orders
GROUP BY user_id
HAVING SUM(amount) > 1000;
```

`WHERE` filters rows before grouping; `HAVING` filters the resulting groups —
a common beginner confusion point worth calling out explicitly.

## Subqueries

```sql
-- Subquery in WHERE
SELECT name FROM users
WHERE id IN (SELECT user_id FROM orders WHERE amount > 500);

-- Subquery in FROM (derived table)
SELECT avg_per_user.user_id, avg_per_user.avg_amount
FROM (
    SELECT user_id, AVG(amount) AS avg_amount FROM orders GROUP BY user_id
) AS avg_per_user
WHERE avg_per_user.avg_amount > 200;

-- Correlated subquery (references the outer query)
SELECT name FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.amount > 1000);
```

## Common Table Expressions (CTEs) — `WITH` queries

CTEs give a subquery a name, improving readability for complex, multi-step queries —
and can be referenced multiple times in the outer query.

```sql
WITH user_totals AS (
    SELECT user_id, SUM(amount) AS total_spent
    FROM orders
    GROUP BY user_id
)
SELECT u.name, ut.total_spent
FROM users u
JOIN user_totals ut ON u.id = ut.user_id
WHERE ut.total_spent > 500;
```

### Recursive CTEs — traversing hierarchies

```sql
-- Find all reports (direct and indirect) of a given manager
WITH RECURSIVE org_chart AS (
    SELECT id, name, manager_id FROM employees WHERE id = 1  -- anchor: the top manager
    UNION ALL
    SELECT e.id, e.name, e.manager_id
    FROM employees e
    JOIN org_chart oc ON e.manager_id = oc.id
)
SELECT * FROM org_chart;
```

Recursive CTEs are the standard SQL way to traverse trees/graphs (org charts,
category hierarchies, threaded comments) that would otherwise require multiple
round trips or application-side recursion.

## Window functions — aggregate without collapsing rows

Unlike `GROUP BY` (which collapses rows into one per group), window functions compute
a value **per row** while looking at a defined "window" of related rows.

```sql
-- Running total per user, ordered by date
SELECT
    user_id, order_date, amount,
    SUM(amount) OVER (PARTITION BY user_id ORDER BY order_date) AS running_total
FROM orders;

-- Rank orders by amount within each user
SELECT
    user_id, amount,
    RANK() OVER (PARTITION BY user_id ORDER BY amount DESC) AS rank_in_user
FROM orders;

-- Row number for deduplication (keep only the latest row per user)
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
    FROM sessions
) sub
WHERE rn = 1;

-- LAG/LEAD: compare a row to the previous/next row
SELECT
    order_date, amount,
    amount - LAG(amount) OVER (ORDER BY order_date) AS change_from_previous
FROM orders;
```

| Window function | Purpose |
|---|---|
| `ROW_NUMBER()` | Sequential number per row within a partition |
| `RANK()` / `DENSE_RANK()` | Ranking, with/without gaps for ties |
| `SUM()`/`AVG()`/`COUNT()` `OVER (...)` | Running/moving aggregates without collapsing rows |
| `LAG()` / `LEAD()` | Access a previous/next row's value |
| `FIRST_VALUE()` / `LAST_VALUE()` | First/last value in the window frame |

Window functions are the standard PostgreSQL tool for analytics-style queries
(running totals, rankings, period-over-period comparisons, deduplication) that would
otherwise require self-joins or application-side post-processing.

## Set operations

```sql
SELECT name FROM customers
UNION           -- combines and de-duplicates
SELECT name FROM suppliers;

SELECT name FROM customers
UNION ALL       -- combines, keeps duplicates (faster)
SELECT name FROM suppliers;

SELECT product FROM current_inventory
INTERSECT       -- only rows present in both
SELECT product FROM discontinued_list;

SELECT product FROM all_products
EXCEPT          -- rows in the first query but not the second
SELECT product FROM discontinued_list;
```

## `UPSERT` — `INSERT ... ON CONFLICT`

```sql
INSERT INTO users (id, name, email)
VALUES (1, 'Alice', 'alice@example.com')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

-- Do nothing on conflict instead of erroring
INSERT INTO users (id, name) VALUES (1, 'Alice')
ON CONFLICT (id) DO NOTHING;
```

`EXCLUDED` refers to the row that would have been inserted — the standard pattern for
"insert, or update if it already exists" logic in a single atomic statement.

## `RETURNING` — get modified rows back immediately

```sql
INSERT INTO users (name, email) VALUES ('Carol', 'carol@example.com') RETURNING id;
UPDATE orders SET status = 'shipped' WHERE id = 5 RETURNING *;
DELETE FROM sessions WHERE expired_at < now() RETURNING id;
```

Avoids a separate `SELECT` round trip after a write — very commonly used from
application code (see `backend_integrations.md`).