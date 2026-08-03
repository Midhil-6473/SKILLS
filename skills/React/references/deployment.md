# Deploying the React + FastAPI AI Stack

## Deployment topology options

| Approach | Description | Best for |
|---|---|---|
| **Separate services** | React static build on a CDN/static host (Vercel, Netlify, S3+CloudFront); FastAPI on a container platform (Fly.io, Railway, ECS, Cloud Run) | Most production apps — independent scaling, clean separation |
| **Single container** | FastAPI serves the built React static files directly | Simpler small apps, internal tools, avoiding CORS entirely |
| **Serverless functions** | FastAPI wrapped for Lambda/Vercel Functions; React on the same platform's static hosting | Spiky/low traffic, cost-sensitive prototypes — watch cold-start latency for model-loading endpoints |

## Containerizing FastAPI

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

For GPU-dependent models (PyTorch/TensorFlow with CUDA):

```dockerfile
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y python3.12 python3-pip
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cu124
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Don't run GPU-heavy inference in the same container as your general API traffic** if
you can avoid it — GPU-enabled compute is expensive; separate your lightweight API
routes from GPU-bound inference into different services so you only pay for GPU
resources where actually needed, and can scale each independently.

## Containerizing React (production build)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# nginx.conf — SPA routing + reverse proxy to FastAPI
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;  # SPA client-side routing fallback
    }
    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_buffering off;                 # critical for SSE streaming!
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
    }
}
```

**`proxy_buffering off` is critical for streaming endpoints** — without it, Nginx
buffers the entire response before forwarding it to the client, completely defeating
token-by-token SSE streaming and making your chat UI appear to hang until the full
response is ready.

## docker-compose for local full-stack development

```yaml
version: "3.8"
services:
  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    volumes: ["./frontend:/app", "/app/node_modules"]
    command: npm run dev -- --host

  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes: ["./backend:/app"]
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
    depends_on: [db, redis]

  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: pass
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

## Environment configuration

```bash
# Frontend (.env, Vite requires VITE_ prefix to expose to client code)
VITE_API_URL=https://api.yourapp.com

# Backend (.env)
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CORS_ORIGINS=https://yourapp.com,http://localhost:5173
```

**Never prefix secrets with `VITE_`** (or your frontend framework's equivalent
public-env-var prefix) — anything with that prefix gets bundled into the client
JavaScript and is visible to anyone who opens dev tools. API keys belong only in
backend environment variables.

## CORS configuration for production

```python
from fastapi.middleware.cors import CORSMiddleware
import os

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ["CORS_ORIGINS"].split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)
```

Be specific about allowed methods/headers in production rather than wildcarding —
narrower CORS configuration is one more layer of defense-in-depth.

## Health checks and readiness (important for ML model loading)

```python
@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/ready")
async def ready():
    if "classifier" not in ml_models:
        raise HTTPException(503, "Model not loaded yet")
    return {"status": "ready"}
```

Separate `/health` (is the process alive) from `/ready` (has the model finished
loading) — container orchestrators (Kubernetes, ECS) should route traffic only once
`/ready` succeeds, since a large model can take real time to load into memory at
startup, and routing traffic before that completes causes failed requests.

## Serverless considerations

```python
# For AWS Lambda via Mangum
from mangum import Mangum
handler = Mangum(app)
```

**Cold starts are the key serverless gotcha for ML/AI apps:** loading a large model
(or even just initializing an LLM provider SDK client) on every cold start adds
real, user-visible latency. Mitigations: keep serverless functions "warm" via
scheduled pings, move heavy model loading to a dedicated always-on service rather
than a serverless function, or accept the cold-start cost for genuinely
low-traffic/spiky workloads where it's a reasonable trade-off against paying for
constant uptime.

## Monitoring AI-specific concerns in production

Beyond standard APM (latency, error rate), AI apps benefit from tracking:
- **Token usage and cost per user/endpoint** — LLM costs scale with usage in a way
  traditional API costs don't; track this explicitly, not just request count.
- **Model/provider error rates separately from your own application errors** — a
  spike in "model unavailable" errors is a different incident than a bug in your
  code.
- **Streaming connection health** — dropped SSE/WebSocket connections mid-response,
  which won't show up as a clean HTTP error code the way a failed request would.

```python
import time

@app.middleware("http")
async def track_llm_usage(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    if request.url.path.startswith("/api/chat"):
        duration = time.time() - start
        log_metric("llm_request_duration", duration, tags={"path": request.url.path})
    return response
```

## Practical guidance

1. **Deploy React and FastAPI as separate services** for most production apps —
   independent scaling and simpler CORS/CDN configuration outweigh the marginal
   simplicity of a single container.
2. **Disable proxy buffering (`proxy_buffering off` in Nginx)** for any streaming
   endpoint — this is the single most common production bug that silently breaks SSE.
3. **Separate GPU-bound inference into its own service** from general API traffic, to
   control cost and scale independently.
4. **Never prefix secrets with your frontend framework's public-env-var prefix**
   (`VITE_`, `NEXT_PUBLIC_`, etc.).
5. **Implement `/health` and `/ready` separately** for any service loading a model at
   startup.
6. **Track token usage/cost and model-provider error rates as first-class metrics**,
   distinct from generic APM.