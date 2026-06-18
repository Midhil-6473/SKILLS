# Database Reference — FastAPI + SQLAlchemy + Alembic

## Table of Contents
1. [Sync vs Async — When to Choose](#1-sync-vs-async)
2. [Sync SQLAlchemy Setup](#2-sync-sqlalchemy-setup)
3. [Async SQLAlchemy Setup](#3-async-sqlalchemy-setup)
4. [Relationships](#4-relationships)
5. [Advanced Queries](#5-advanced-queries)
6. [Alembic Migrations](#6-alembic-migrations)
7. [SQLModel (Alternative)](#7-sqlmodel)

---

## 1. Sync vs Async

| | Sync (SQLAlchemy) | Async (SQLAlchemy asyncio) |
|---|---|---|
| Best for | Simple apps, scripts | High-concurrency APIs |
| Drivers | psycopg2, pymysql | asyncpg, aiomysql |
| Complexity | Lower | Higher |
| FastAPI routes | Works in both `def` and `async def`* | Must use `async def` |

*Calling sync DB in an `async def` endpoint **blocks** the event loop. Use `run_in_executor` or switch to async.

---

## 2. Sync SQLAlchemy Setup

```python
# db/session.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "postgresql://user:password@localhost:5432/mydb"
# SQLite for dev: "sqlite:///./dev.db"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # Test connections before use
    pool_size=10,         # Max connections in pool
    max_overflow=20,      # Connections beyond pool_size allowed temporarily
    echo=False,           # Set True to log all SQL (dev only)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## 3. Async SQLAlchemy Setup

```python
# db/session.py
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "postgresql+asyncpg://user:password@localhost:5432/mydb"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevent lazy-load errors after commit
)

class Base(DeclarativeBase):
    pass

# Async dependency
async def get_async_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### Async CRUD example
```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    db_user = User(email=user_in.email, hashed_password=hash(user_in.password))
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user
```

---

## 4. Relationships

```python
# models/user.py
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    # One user has many posts
    posts = relationship("Post", back_populates="author", lazy="selectin")

class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author = relationship("User", back_populates="posts")
```

### Lazy Loading Strategies
```python
# lazy="select"  — default, fires a query when attribute is accessed (N+1 risk)
# lazy="joined"  — JOIN in same query (good for one-to-one)
# lazy="selectin"— separate SELECT IN query (good for one-to-many, avoids cartesian product)
# lazy="dynamic" — returns a query object (deprecated in SQLAlchemy 2.x)

# For async, only "selectin" and "joined" work. Never use "select" (lazy) in async context.
```

### Many-to-Many
```python
from sqlalchemy import Table

post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", ForeignKey("posts.id"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id"), primary_key=True),
)

class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True)
    tags = relationship("Tag", secondary=post_tags, back_populates="posts")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    posts = relationship("Post", secondary=post_tags, back_populates="tags")
```

---

## 5. Advanced Queries

```python
from sqlalchemy import select, func, and_, or_, desc, case
from sqlalchemy.orm import joinedload

# Filtering
stmt = select(User).where(
    and_(User.is_active == True, User.email.like("%@example.com"))
)

# OR
stmt = select(User).where(
    or_(User.role == "admin", User.is_superuser == True)
)

# Eager loading (prevents N+1)
stmt = select(User).options(joinedload(User.posts))

# Aggregate
stmt = select(func.count(User.id)).where(User.is_active == True)
count = (await db.execute(stmt)).scalar()

# Pagination
stmt = select(Item).order_by(desc(Item.created_at)).offset(skip).limit(limit)

# Subquery
active_users = select(User.id).where(User.is_active == True).subquery()
stmt = select(Post).where(Post.author_id.in_(active_users))

# Group by + Having
stmt = (
    select(User.id, func.count(Post.id).label("post_count"))
    .join(Post)
    .group_by(User.id)
    .having(func.count(Post.id) > 5)
)
```

---

## 6. Alembic Migrations

### Setup
```bash
pip install alembic
alembic init alembic
```

Edit `alembic.ini`:
```ini
sqlalchemy.url = postgresql://user:pass@localhost/dbname
```

Edit `alembic/env.py`:
```python
from app.db.session import Base
from app.models import user, item  # Import all models so Alembic sees them

target_metadata = Base.metadata
```

### Common Commands
```bash
# Create a new migration (auto-detect changes)
alembic revision --autogenerate -m "add users table"

# Apply all pending migrations
alembic upgrade head

# Roll back one step
alembic downgrade -1

# Roll back all
alembic downgrade base

# See current version
alembic current

# Show history
alembic history --verbose
```

### Migration File Structure
```python
# alembic/versions/abc123_add_users.py
def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

def downgrade() -> None:
    op.drop_table("users")
```

---

## 7. SQLModel (Alternative)

SQLModel merges Pydantic + SQLAlchemy into one class — less boilerplate, perfect for smaller apps.

```python
from sqlmodel import SQLModel, Field, Session, create_engine, select
from typing import Optional

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    is_active: bool = True

class UserCreate(SQLModel):
    email: str

engine = create_engine("sqlite:///./dev.db")
SQLModel.metadata.create_all(engine)

def get_db():
    with Session(engine) as session:
        yield session

@app.post("/users/", response_model=User)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = User.from_orm(user)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
```

**When to use SQLModel vs SQLAlchemy?**
- Small/medium apps, rapid prototyping → SQLModel
- Large enterprise apps, complex queries, team already knows SQLAlchemy → SQLAlchemy