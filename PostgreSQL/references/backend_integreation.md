# ORMs & Backend Framework Integration — Node.js, Python, Java

## The ORM landscape at a glance

| ORM | Language/Ecosystem | Style | Best for |
|---|---|---|---|
| **Prisma** | Node.js/TypeScript | Schema-first, auto-generated type-safe client | Modern TypeScript apps, Next.js, serverless, teams prioritizing type safety and DX |
| **Sequelize** | Node.js/JavaScript | Traditional Active Record | Mature/legacy codebases, teams not TypeScript-first |
| **TypeORM** | Node.js/TypeScript | Decorator-based, Active Record or Data Mapper | NestJS projects, enterprise TypeScript apps |
| **Drizzle** | Node.js/TypeScript | Lightweight, SQL-like query builder + types | Teams wanting close-to-SQL control with type safety, minimal overhead |
| **SQLAlchemy** | Python | Core (expression language) + ORM layer | Standalone Python apps, microservices, FastAPI, fine-grained query control |
| **Django ORM** | Python | Built into Django, declarative models | Django projects — seamless integration with migrations, admin, forms |
| **Hibernate / Spring Data JPA** | Java | Annotation-based entities, repository pattern | Spring Boot and enterprise Java applications |

**General guidance:** Prisma or Drizzle for new TypeScript projects; SQLAlchemy for
standalone Python services, Django ORM if already using Django; Spring Data JPA is the
default for Spring Boot. Raw SQL/query builders remain valuable for complex
reporting queries or performance-critical paths regardless of which ORM you use
elsewhere in the app.

## Node.js — raw driver (`pg`)

```bash
npm install pg
```

```js
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getUsers() {
  const result = await pool.query("SELECT * FROM users WHERE age > $1", [25]);
  return result.rows;
}
```

Always use **parameterized queries** (`$1`, `$2`, ...) rather than string
concatenation — this is the standard defense against SQL injection, and every driver/
ORM below does this automatically under the hood.

## Prisma — schema-first, type-safe

```bash
npm install prisma @prisma/client
npx prisma init
```

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id     Int     @id @default(autoincrement())
  name   String
  email  String  @unique
  orders Order[]
}

model Order {
  id       Int     @id @default(autoincrement())
  amount   Decimal
  user     User    @relation(fields: [userId], references: [id])
  userId   Int
}
```

```bash
npx prisma migrate dev --name init    # generates & applies a migration
npx prisma generate                    # regenerates the type-safe client
npx prisma studio                      # built-in GUI to browse/edit data
```

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const user = await prisma.user.create({
  data: { name: "Alice", email: "alice@example.com" },
});

const usersWithOrders = await prisma.user.findMany({
  where: { orders: { some: { amount: { gt: 100 } } } },
  include: { orders: true },
});
```

**Serverless note:** Prisma's query engine can have a "cold start" cost in serverless
environments (Lambda, edge functions) — evaluate this for latency-sensitive serverless
deployments, and use Prisma's `driverAdapters`/connection-pooling guidance for
platforms like Vercel.

## Sequelize — traditional Active Record

```bash
npm install sequelize pg pg-hstore
```

```js
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize(process.env.DATABASE_URL, { dialect: "postgres" });

const User = sequelize.define("User", {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
});

const Order = sequelize.define("Order", {
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
});

User.hasMany(Order);
Order.belongsTo(User);

await sequelize.sync();  // create tables (use migrations in production instead)

const user = await User.create({ name: "Alice", email: "alice@example.com" });
const orders = await Order.findAll({ where: { amount: { [Op.gt]: 100 } }, include: User });
```

## TypeORM — decorator-based entities

```bash
npm install typeorm reflect-metadata pg
```

```ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from "typeorm";

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];
}

@Entity()
class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("decimal")
  amount: number;

  @ManyToOne(() => User, (user) => user.orders)
  user: User;
}
```

```ts
import { DataSource } from "typeorm";

const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [User, Order],
  synchronize: false,  // use migrations in production, not synchronize: true
});

const userRepo = AppDataSource.getRepository(User);
const user = await userRepo.save({ name: "Alice", email: "alice@example.com" });
```

## Express.js REST API (with any of the above)

```js
const express = require("express");
const app = express();
app.use(express.json());

app.post("/api/users", async (req, res) => {
  try {
    const user = await prisma.user.create({ data: req.body });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === "P2002") {  // Prisma unique constraint violation
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000);
```

## Next.js integration

```ts
// lib/prisma.js — cached client pattern to survive hot-reload/serverless reuse
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global;
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

```ts
// app/api/users/route.js
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const users = await prisma.user.findMany();
  return NextResponse.json(users);
}
```

Same caching principle as MongoDB drivers in serverless: reuse the client across
invocations rather than creating a new one per request.

## Python — SQLAlchemy (standalone / FastAPI)

```bash
pip install sqlalchemy psycopg2-binary
```

```python
from sqlalchemy import create_engine, Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

engine = create_engine(os.environ["DATABASE_URL"])
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    orders = relationship("Order", back_populates="user")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    amount = Column(Numeric(10, 2), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="orders")

Session = sessionmaker(bind=engine)
session = Session()

user = User(name="Alice", email="alice@example.com")
session.add(user)
session.commit()

big_spenders = session.query(User).join(Order).filter(Order.amount > 100).all()
```

### FastAPI + SQLAlchemy (async, the modern pairing)

```bash
pip install sqlalchemy[asyncio] asyncpg fastapi uvicorn
```

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from fastapi import FastAPI, Depends

engine = create_async_engine(os.environ["DATABASE_URL"])
app = FastAPI()

@app.get("/api/users")
async def get_users(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User))
    return result.scalars().all()
```

## Python — Django ORM

```python
# models.py
from django.db import models

class User(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)

class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
```

```python
# settings.py
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["DB_NAME"],
        "USER": os.environ["DB_USER"],
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": os.environ["DB_HOST"],
        "PORT": "5432",
    }
}
```

```bash
python manage.py makemigrations
python manage.py migrate
```

```python
# views.py
big_spenders = User.objects.filter(orders__amount__gt=100).distinct()
```

Django ORM's tight integration with migrations, the admin panel, and forms makes it
the natural choice whenever the rest of the stack is already Django — not typically
worth introducing standalone for a non-Django project.

## Java — Spring Boot + Spring Data JPA

```java
@Entity
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    @Column(unique = true)
    private String email;
    @OneToMany(mappedBy = "user")
    private List<Order> orders;
}

public interface UserRepository extends JpaRepository<User, Long> {
    List<User> findByOrdersAmountGreaterThan(BigDecimal amount);
}
```

```properties
# application.properties
spring.datasource.url=jdbc:postgresql://localhost:5432/mydb
spring.datasource.username=${DB_USER}
spring.datasource.password=${DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=validate   # use migrations (Flyway/Liquibase), not auto-generate in prod
```

Spring Data JPA's repository pattern auto-generates query implementations from method
names (`findByOrdersAmountGreaterThan`) — no manual query-writing needed for common
cases, similar in spirit to how MongoDB's Spring Data repositories work.

## Universal integration principles

1. **Always use parameterized queries** — never string-concatenate user input into
   SQL, regardless of ORM or raw driver.
2. **Use migrations, not auto-sync/auto-generate**, in any production deployment —
   `sequelize.sync()`, TypeORM's `synchronize: true`, and Hibernate's
   `ddl-auto=update` are convenient for prototyping but dangerous for production
   schema changes.
3. **Connection pooling matters** — use each ORM's built-in pool configuration
   (`Pool` in `pg`, Prisma's connection pooling guidance, SQLAlchemy's `pool_size`) and
   consider PgBouncer in front for serverless/high-connection-count deployments (see
   `scaling_and_production.md`).
4. **Cache the client/engine instance** across requests/invocations — never
   instantiate a new client per request, and use the `global`-scoped caching pattern
   in serverless/Next.js environments.
5. **Handle unique constraint violations explicitly** — every ORM surfaces
   PostgreSQL's unique violation (`23505`) differently (Prisma: `P2002`, raw `pg`:
   `err.code === '23505'`) — catch it and return a clean error rather than a 500.