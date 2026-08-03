# Deployment Reference — FastAPI

## Table of Contents
1. [Docker & Docker Compose](#1-docker)
2. [Nginx Reverse Proxy](#2-nginx)
3. [Environment Config](#3-environment-config)
4. [Logging](#4-logging)
5. [Health Checks & Monitoring](#5-monitoring)
6. [Cloud Deployments](#6-cloud)
7. [Performance Tuning](#7-performance)

---

## 1. Docker & Docker Compose

### Dockerfile (Production)
```dockerfile
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (cached layer)
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy app code
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Multi-stage build (smaller image)
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install /usr/local
COPY . .
RUN adduser --disabled-password appuser && chown -R appuser /app
USER appuser
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml
```yaml
version: "3.9"

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
      - SECRET_KEY=${SECRET_KEY}
      - DEBUG=false
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## 2. Nginx Reverse Proxy

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:8000;
        keepalive 32;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    server {
        listen 80;
        server_name example.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name example.com;

        ssl_certificate /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header Strict-Transport-Security "max-age=31536000" always;

        location / {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_read_timeout 300s;
        }

        # WebSocket support
        location /ws/ {
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

---

## 3. Environment Config

```python
# core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import list

class Settings(BaseSettings):
    # App
    app_name: str = "My API"
    debug: bool = False
    environment: str = "production"
    
    # Database
    database_url: str
    db_pool_size: int = 10
    db_max_overflow: int = 20
    
    # Auth
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    
    # CORS
    allowed_origins: list[str] = []
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # External services
    sendgrid_api_key: str = ""
    sentry_dsn: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

settings = Settings()
```

`.env` (never commit this):
```
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
SECRET_KEY=your-256-bit-secret-key-here-use-openssl-rand-hex-32
DEBUG=false
ALLOWED_ORIGINS=["https://myapp.com","https://www.myapp.com"]
REDIS_URL=redis://localhost:6379
SENTRY_DSN=https://your-key@sentry.io/project-id
```

---

## 4. Logging

```python
# core/logging.py
import logging
import sys
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)

def setup_logging():
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root_logger.addHandler(handler)
    
    # Silence noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# main.py
from app.core.logging import setup_logging
setup_logging()
logger = logging.getLogger(__name__)

# Usage in endpoints
@app.get("/items/{item_id}")
async def get_item(item_id: int, request: Request):
    logger.info(
        "Fetching item",
        extra={"item_id": item_id, "request_id": request.state.request_id}
    )
```

---

## 5. Health Checks & Monitoring

```python
# api/v1/endpoints/health.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import redis.asyncio as aioredis

router = APIRouter()

@router.get("/health")
async def health():
    """Basic liveness check."""
    return {"status": "ok"}

@router.get("/health/detailed")
async def detailed_health(db: Session = Depends(get_db)):
    """Readiness check — verifies all dependencies are reachable."""
    checks = {}
    
    # DB check
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
    
    # Redis check
    try:
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"
    
    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }
```

### Sentry Integration
```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.1,  # 10% of transactions
    )
```

---

## 6. Cloud Deployments

### AWS Lambda (with Mangum)
```python
# main.py
from mangum import Mangum
handler = Mangum(app, lifespan="off")
```

### Google Cloud Run
```bash
gcloud run deploy my-api \
  --image gcr.io/my-project/my-api \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=$DATABASE_URL,SECRET_KEY=$SECRET_KEY \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1
```

### Render (simplest option)
```yaml
# render.yaml
services:
  - type: web
    name: my-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: my-db
          property: connectionString
```

---

## 7. Performance Tuning

### Uvicorn Workers
```bash
# Rule of thumb: 2 * CPU_CORES + 1 workers
uvicorn app.main:app --workers 9 --host 0.0.0.0 --port 8000

# With Gunicorn (more robust process management)
gunicorn app.main:app -w 9 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### Response Compression
```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

### Connection Pooling (PgBouncer or built-in)
```python
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,          # Connections per worker
    max_overflow=10,       # Extra temporary connections
    pool_timeout=30,       # Wait up to 30s for a connection
    pool_recycle=3600,     # Recycle connections after 1 hour
    pool_pre_ping=True,    # Test connections before use
)
```

### Profiling Slow Endpoints
```python
# For dev: add timing middleware
import time

@app.middleware("http")
async def time_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    if duration > 1.0:  # Log slow requests
        logger.warning(f"Slow request: {request.url} took {duration:.2f}s")
    response.headers["X-Response-Time"] = f"{duration:.4f}s"
    return response
```