---
name: fastapi
description: >
  Comprehensive FastAPI mentor skill — use this whenever the user asks about building, designing,
  debugging, or deploying a FastAPI application, API endpoint, or backend service in Python.
  Triggers on: "FastAPI", "fast api", building a REST API in Python, async Python backend,
  pydantic models, uvicorn, SQLAlchemy with FastAPI, JWT auth in FastAPI, CORS setup,
  dependency injection, background tasks, WebSockets in Python, or any question about
  creating Python web APIs. Use this skill even if the user asks a narrow question
  (e.g. "how do I add auth to my FastAPI app") — this guide has the answer.
---

# FastAPI Expert Mentor

You are an expert FastAPI mentor. This skill covers everything from first steps to
production deployment. Follow the level progression below — beginners start at Level 1,
intermediates jump to Level 3, advanced users go straight to Level 5+.

## Quick Navigation

| Level | Topics |
|---|---|
| **1 — Foundations** | Install, first route, path/query params, running the server |
| **2 — Request & Response** | Pydantic models, request bodies, response models, status codes |
| **3 — Core Architecture** | Dependency injection, routers, project structure, error handling |
| **4 — Database Layer** | SQLAlchemy, SQLModel, async DB, migrations with Alembic |
| **5 — Auth & Security** | OAuth2, JWT tokens, password hashing, role-based access |
| **6 — Advanced Features** | Background tasks, WebSockets, file upload, middleware, caching |
| **7 — Testing** | pytest, TestClient, async tests, mocking dependencies |
| **8 — Production** | Docker, env config, logging, rate limiting, deployment |

For deep reference on any topic, read the matching file in `references/`.

---

## Level 1 — Foundations

### Installation
```bash
pip install fastapi uvicorn[standard]
# For full stack:
pip install fastapi uvicorn[standard] sqlalchemy alembic pydantic-settings python-jose[cryptography] passlib[bcrypt] httpx pytest
```

### Your First App
```python
# main.py
from fastapi import FastAPI

app = FastAPI(title="My API", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

```bash
uvicorn main:app --reload        # dev
uvicorn main:app --host 0.0.0.0 --port 8000  # prod-like
```

Interactive docs auto-generated at: `http://localhost:8000/docs` (Swagger) and `/redoc`.

### Path & Query Parameters
```python
from fastapi import FastAPI, Path, Query
from typing import Optional

app = FastAPI()

# Path parameter — part of the URL
@app.get("/items/{item_id}")
async def get_item(
    item_id: int = Path(..., gt=0, description="The item ID"),
):
    return {"item_id": item_id}

# Query parameters — after the ?
@app.get("/items/")
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, le=100),
    search: Optional[str] = None,
):
    return {"skip": skip, "limit": limit, "search": search}

# Both together
@app.get("/users/{user_id}/orders")
async def get_user_orders(
    user_id: int,
    status: Optional[str] = None,
    page: int = 1,
):
    return {"user_id": user_id, "status": status, "page": page}
```

**Key rule**: Path params are required; query params with defaults are optional.

---

## Level 2 — Request & Response

### Pydantic Models (Schema Definition)
```python
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

class StatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"
    pending = "pending"

# Input model — what the client sends
class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    price: float = Field(..., gt=0)
    description: Optional[str] = Field(None, max_length=500)
    status: StatusEnum = StatusEnum.active

    @validator("name")
    def name_must_not_be_blank(cls, v):
        if v.strip() == "":
            raise ValueError("name cannot be blank")
        return v.strip()

    class Config:
        # Accept snake_case and camelCase input
        populate_by_name = True

# Output model — what we return (may differ from DB model)
class ItemResponse(BaseModel):
    id: int
    name: str
    price: float
    status: StatusEnum
    created_at: datetime

    class Config:
        from_attributes = True  # Allows ORM → Pydantic conversion
```

### Request Bodies & Response Models
```python
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse

app = FastAPI()

# Use response_model to filter/shape output — never expose raw DB objects
@app.post(
    "/items/",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new item",
    tags=["items"],
)
async def create_item(item: ItemCreate):
    # In real code, save to DB here
    return ItemResponse(id=1, **item.dict(), created_at=datetime.utcnow())

# List response
@app.get("/items/", response_model=List[ItemResponse])
async def list_items():
    return []

# Return different status codes dynamically
@app.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: int):
    # If not found, raise HTTPException (see Level 3)
    return None  # 204 returns no body
```

### HTTP Errors
```python
from fastapi import HTTPException, status

@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int):
    item = fake_db.get(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item {item_id} not found",
        )
    return item
```

---

## Level 3 — Core Architecture

### Dependency Injection
DI is FastAPI's most powerful pattern. Use it for: DB sessions, auth, pagination, feature flags.

```python
from fastapi import Depends, FastAPI, Header, HTTPException

app = FastAPI()

# Simple dependency
def get_pagination(skip: int = 0, limit: int = 10):
    return {"skip": skip, "limit": limit}

@app.get("/items/")
async def list_items(pagination: dict = Depends(get_pagination)):
    return pagination

# Dependency with cleanup (generator pattern — ALWAYS use for DB sessions)
def get_db():
    db = SessionLocal()
    try:
        yield db          # FastAPI calls cleanup even if an exception occurs
    finally:
        db.close()

@app.get("/users/")
def read_users(db: Session = Depends(get_db)):
    return db.query(User).all()

# Chained dependencies
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user = verify_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, admin: User = Depends(require_admin)):
    ...
```

### Project Structure (Production Layout)
```
app/
├── main.py                  # App factory, middleware, startup events
├── api/
│   ├── __init__.py
│   ├── deps.py              # Shared dependencies (get_db, get_current_user)
│   └── v1/
│       ├── __init__.py
│       ├── router.py        # Combines all v1 routers
│       └── endpoints/
│           ├── users.py
│           ├── items.py
│           └── auth.py
├── core/
│   ├── config.py            # Settings via pydantic-settings
│   └── security.py          # Password hashing, JWT logic
├── db/
│   ├── base.py              # SQLAlchemy Base
│   ├── session.py           # Engine + SessionLocal
│   └── init_db.py           # DB bootstrap
├── models/                  # SQLAlchemy ORM models
│   ├── user.py
│   └── item.py
├── schemas/                 # Pydantic request/response models
│   ├── user.py
│   └── item.py
├── crud/                    # DB query functions
│   ├── base.py
│   ├── user.py
│   └── item.py
└── tests/
    ├── conftest.py
    └── api/
        ├── test_users.py
        └── test_items.py
```

### Routers
```python
# api/v1/endpoints/items.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user

router = APIRouter(prefix="/items", tags=["items"])

@router.get("/", response_model=list[ItemResponse])
async def list_items(db: Session = Depends(get_db)):
    return crud.item.get_multi(db)

@router.post("/", response_model=ItemResponse, status_code=201)
async def create_item(
    item_in: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.item.create(db, obj_in=item_in)

# api/v1/router.py
from fastapi import APIRouter
from .endpoints import items, users, auth

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(items.router, prefix="/items", tags=["items"])

# main.py
from fastapi import FastAPI
from app.api.v1.router import api_router

app = FastAPI()
app.include_router(api_router, prefix="/api/v1")
```

### Custom Exception Handlers
```python
from fastapi import Request
from fastapi.responses import JSONResponse

class AppException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "path": str(request.url)},
    )
```

---

## Level 4 — Database Layer

> For full setup, read → `references/database.md`

### SQLAlchemy Setup (Sync)
```python
# db/session.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "postgresql://user:pass@localhost/dbname"

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass
```

### Async SQLAlchemy (Recommended for New Projects)
```python
# db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

DATABASE_URL = "postgresql+asyncpg://user:pass@localhost/dbname"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_async_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### ORM Models
```python
# models/user.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### CRUD Pattern
```python
# crud/user.py
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash

def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return db.query(User).offset(skip).limit(limit).all()

def create_user(db: Session, user_in: UserCreate) -> User:
    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
```

---

## Level 5 — Auth & Security

> For full JWT implementation, read → `references/auth.md`

### Password Hashing
```python
# core/security.py
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "your-secret-key-store-in-env"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

### OAuth2 Password Flow
```python
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends, HTTPException, status

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

# Login endpoint
@router.post("/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

# Protected endpoint
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = crud.user.get_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user
```

### CORS (Required for Frontend Integration)
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Level 6 — Advanced Features

### Background Tasks
```python
from fastapi import BackgroundTasks

def send_welcome_email(email: str):
    # This runs after the response is sent — doesn't block the client
    email_client.send(to=email, subject="Welcome!")

@app.post("/register")
async def register(user_in: UserCreate, background_tasks: BackgroundTasks):
    user = create_user(user_in)
    background_tasks.add_task(send_welcome_email, user.email)
    return user  # Response sent immediately; email sends in background
```

### File Upload
```python
from fastapi import UploadFile, File
import shutil

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    # Validate type
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(400, "Only JPEG/PNG allowed")
    
    # Stream to disk (don't load large files into memory)
    with open(f"uploads/{file.filename}", "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"filename": file.filename, "size": file.size}
```

### WebSockets
```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import List

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.append(ws)

    async def broadcast(self, message: str):
        for conn in self.active_connections:
            await conn.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(f"{client_id}: {data}")
    except WebSocketDisconnect:
        manager.active_connections.remove(websocket)
```

### Middleware
```python
import time
from fastapi import Request

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(time.time() - start)
    return response

# Request ID middleware
import uuid

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

### Caching with Redis
```python
import redis.asyncio as aioredis
import json

redis_client = aioredis.from_url("redis://localhost")

async def get_cached_or_fetch(key: str, fetch_fn, ttl: int = 300):
    cached = await redis_client.get(key)
    if cached:
        return json.loads(cached)
    data = await fetch_fn()
    await redis_client.setex(key, ttl, json.dumps(data))
    return data
```

---

## Level 7 — Testing

> For full testing patterns, read → `references/testing.md`

```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db.session import Base
from app.api.deps import get_db

TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            db.close()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

# tests/api/test_items.py
def test_create_item(client, auth_headers):
    response = client.post(
        "/api/v1/items/",
        json={"name": "Test Item", "price": 9.99},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Item"
    assert "id" in data

def test_create_item_invalid_price(client, auth_headers):
    response = client.post(
        "/api/v1/items/",
        json={"name": "Test Item", "price": -1},
        headers=auth_headers,
    )
    assert response.status_code == 422  # Validation error
```

---

## Level 8 — Production

> For complete deployment guide, read → `references/deployment.md`

### Configuration with pydantic-settings
```python
# core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "My API"
    debug: bool = False
    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 30
    allowed_origins: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()  # Auto-reads from .env
```

### App Factory with Lifespan
```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize DB, redis, etc.
    await init_db()
    yield
    # Shutdown: cleanup
    await redis_client.close()

app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,  # Hide docs in prod
    redoc_url=None,
)
```

### Structured Logging
```python
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "time": self.formatTime(record),
        })

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
```

### Dockerfile
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

---

## Common Pitfalls & Quick Fixes

| Problem | Cause | Fix |
|---|---|---|
| 422 Unprocessable Entity | Pydantic validation failed | Check request body matches schema exactly |
| 307 Temporary Redirect | Trailing slash mismatch | Add `redirect_slashes=False` to FastAPI() or fix the URL |
| CORS error in browser | Missing CORSMiddleware | Add middleware **before** any routes |
| `greenlet_spawn` error | Sync DB call in async route | Use `run_in_executor` or switch to async SQLAlchemy |
| Circular import | Models importing from schemas | Use `TYPE_CHECKING` guard or restructure |
| N+1 queries | Missing `.joinedload()` | Add eager loading: `options(joinedload(User.items))` |
| Slow startup | Heavy imports at module level | Lazy import inside functions or use lifespan |

---

## Reference Files

- `references/database.md` — Full SQLAlchemy + Alembic migration guide
- `references/auth.md` — Complete JWT, refresh tokens, OAuth2 flows
- `references/testing.md` — Async tests, mocking, fixtures, coverage
- `references/deployment.md` — Docker Compose, Nginx, CI/CD, scaling