# FastAPI Skill: The Expert Mentor's Guide

You are an expert FastAPI mentor. This guide outlines the core principles, architecture, and integration patterns for building production-ready APIs.

## 1. Core Concepts & Examples

### Path and Query Parameters
- **Path Parameters**: Used for unique resource identification.
- **Query Parameters**: Used for filtering, sorting, and optional settings.

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "query": q}
```

### Request Body & Pydantic Models
Validation is automatic. Use Pydantic to define the shape of your data.

```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    price: float
    is_offer: bool = None

@app.post("/items/")
async def create_item(item: Item):
    return item
```

## 2. How it Works (Under the Hood)

1. **ASGI (Asynchronous Server Gateway Interface)**: FastAPI runs on servers like `uvicorn` (based on `uvloop`).
2. **Async/Await**: Engineered for non-blocking I/O. Use `async def` for endpoints that wait on DBs or APIs.
3. **Pydantic**: Handles data serialization, deserialization, and validation.
4. **Starlette**: The foundation for routing, session, and cookie handling.
5. **Dependency Injection**: A powerful system to manage shared logic (DB sessions, Auth, etc.).

## 3. Database Integration (SQLAlchemy/SQLModel)

Use the "Dependency" pattern to ensure sessions are closed properly.

```python
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from fastapi import Depends

SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users/")
def read_users(db: Session = Depends(get_db)):
    return db.query(User).all()
```

## 4. Frontend & Full-Stack Integration

### CORS (Cross-Origin Resource Sharing)
Essential for connecting to React, Vue, or Next.js.

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Frontend Example (JavaScript Fetch)
```javascript
const response = await fetch('http://localhost:8000/items/5?q=fastapi');
const data = await response.json();
console.log(data);
```

## 5. Production Best Practices

1. **Folder Structure**:
   ```
   app/
   ├── main.py
   ├── api/
   │   ├── endpoints/
   │   └── deps.py
   ├── core/
   │   └── config.py
   ├── models/
   └── schemas/
   ```
2. **Environment Variables**: Use `pydantic-settings`.
3. **Security**: Implement OAuth2 with Password flow and JWT tokens.
4. **Testing**: Use `pytest` and `httpx.ASGITransport`.
5. **Dockerization**: Use official optimized images (`tiangolo/uvicorn-gunicorn-fastapi`).

## 6. Deployment Advice
- **Cloud**: AWS Lambda (with Mangum), Google Cloud Run, or Azure Functions.
- **Traditional**: Nginx as a reverse proxy for Uvicorn/Gunicorn.
- **Monitoring**: Sentry or Prometheus/Grafana.