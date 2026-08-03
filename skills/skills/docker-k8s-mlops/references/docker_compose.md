# docker-compose for Local Multi-Service ML Stacks

## Why Compose, and where it stops being enough

`docker-compose` orchestrates multiple containers on a **single host** via a
declarative YAML file — the right tool for local development environments and
small, single-machine deployments involving more than one service (an API, a
database, a cache, maybe a training container). It is **not** a substitute for
Kubernetes in production: Compose gives you `docker compose up --scale
serving=3` for basic replication, but no real routing, health-based load
balancing, rolling updates, or multi-host scheduling — that's exactly the gap
Kubernetes fills.

## A realistic ML stack: API + Postgres + Redis

```yaml
version: "3.8"

services:
  api:
    build: ./api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
      - REDIS_URL=redis://redis:6379
      - MODEL_PATH=/app/artifacts/model.joblib
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./artifacts:/app/artifacts:ro   # read-only model artifacts

  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

```bash
docker compose up -d          # start everything in the background
docker compose logs -f api    # tail logs for one service
docker compose down           # stop and remove containers (add -v to also remove volumes)
```

## `depends_on` with health conditions — avoiding race conditions

```yaml
depends_on:
  db:
    condition: service_healthy   # waits for db's healthcheck to pass, not just "started"
```

Plain `depends_on: [db]` only waits for the container to **start**, not for
Postgres to actually be ready to accept connections — a very common source of
"connection refused" errors on the first `docker compose up`. Always pair
`depends_on` with a `condition: service_healthy` and a real `healthcheck` on the
dependency for anything that needs to actually be *ready*, not just running.

## GPU training container in Compose

```yaml
services:
  trainer:
    build: ./training
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    volumes:
      - ./data:/app/data:ro
      - ./artifacts:/app/artifacts
```

Requires the NVIDIA Container Toolkit on the host (see `gpu_containers.md`) — the
`deploy.resources.reservations.devices` block is Compose's way of requesting GPU
access, analogous to `--gpus` on the CLI or `nvidia.com/gpu` in a Kubernetes pod
spec.

## Profiles — running only the services you need for a given task

```yaml
services:
  api:
    build: ./api
    profiles: ["serving"]

  trainer:
    build: ./training
    profiles: ["training"]

  jupyter:
    build: ./notebooks
    profiles: ["dev"]
```

```bash
docker compose --profile serving up      # just the API stack
docker compose --profile training up     # just the training container
```

Profiles let one `docker-compose.yml` describe an entire project's services while
letting you start only the relevant subset for a given task — avoids needing
separate compose files for "I'm training" vs. "I'm serving" vs. "I'm doing
exploratory analysis in a notebook."

## Secrets in Compose — local dev only

```yaml
services:
  api:
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb   # fine for LOCAL DEV ONLY
```

Plaintext passwords in a compose file are acceptable for local development but
**never for anything resembling production**. For production, use Docker secrets,
a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager), or — once
you've moved to Kubernetes — native Kubernetes Secrets (see
`kubernetes_fundamentals.md`). Never commit real credentials to a repository,
compose file or otherwise.

## Practical guidance

1. **Use Compose for local dev and single-host small deployments** — not as a
   production orchestrator for anything needing real scaling or self-healing.
2. **Always pair `depends_on` with `condition: service_healthy`** for any
   dependency the app needs to actually be ready, not merely started.
3. **Use profiles to keep one compose file covering serving, training, and dev
   without needing separate files.**
4. **Mount model artifacts as read-only volumes** (`:ro`) into serving containers
   when they're managed outside the image, rather than baked in.
5. **Treat Compose secrets as local-dev-only** — never carry plaintext credentials
   from a compose file into any real deployment.