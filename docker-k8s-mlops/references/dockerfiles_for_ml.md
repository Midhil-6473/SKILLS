# Writing Production Dockerfiles for ML/AI Apps

## The problem multi-stage builds solve

A naive ML Dockerfile installs build tools (compilers, dev headers needed to build
some Python packages from source), copies your code, and ships all of it — including
build tools nothing at runtime actually needs — in the final image. This routinely
produces 1.5GB+ images that are slow to build, slow to push/pull, and slow to scale
(every new pod has to pull that full image).

**Multi-stage builds** solve this by using one stage to build/install everything,
then copying only the final artifacts into a clean, minimal runtime stage.

## A complete multi-stage Dockerfile for a FastAPI ML service

```dockerfile
# ---- Stage 1: build ----
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ---- Stage 2: runtime ----
FROM python:3.12-slim

WORKDIR /app
# Copy only the installed packages from the builder stage, not build tools
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

COPY . .

# Run as a non-root user — a real security practice, not boilerplate
RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

The runtime stage never sees a compiler or dev headers — only the Python
interpreter, installed packages, and application code. This alone frequently cuts
image size by 50%+ for packages with heavy build-time dependencies (e.g. anything
requiring compilation).

## Dependency pinning — the #1 source of "works in training, breaks in serving"

```txt
# requirements.txt — pin exact versions, especially ML libraries
scikit-learn==1.5.2
torch==2.4.1
fastapi==0.115.0
pydantic==2.9.2
```

```dockerfile
RUN pip install --no-cache-dir -r requirements.txt
```

**The most common real-world ML container failure**: `model.pkl` (or a saved
PyTorch/TF checkpoint) won't load in the container because the pickling/serialization
library version differs between the training environment and the container's
installed version. **Pin every ML library to the exact version used at training
time** — not a version range, not "latest." This is non-negotiable for anything
beyond a toy project.

## Pre-loading models at build time vs. runtime

```dockerfile
# Option A: bake the model artifact into the image (simple, but image changes per model version)
COPY artifacts/model.joblib /app/artifacts/model.joblib

# Option B: download the model at container startup from object storage (larger images
# avoided, but requires network access and adds startup latency)
```

**Baking the model into the image** (Option A) is the simpler default for most
projects — the image itself becomes the versioned, reproducible artifact, and
there's no runtime dependency on external storage being reachable. Reach for
runtime download (Option B) only when models are very large (multi-GB LLM weights)
or need to be swapped without a full image rebuild.

## FastAPI `lifespan` for model loading — same pattern, more consequential in a container

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import joblib

ml_models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_models["classifier"] = joblib.load("artifacts/model.joblib")
    yield
    ml_models.clear()

app = FastAPI(lifespan=lifespan)
```

This is identical to the pattern in the `react-ai-architect` skill's
`fastapi_ml_serving.md` — the consequence of getting it wrong (reloading the model
per-request) is far more visible in a scaled Kubernetes deployment, where every one
of N replicas would independently pay that cost on every single request. Note:
**avoid the deprecated `@app.on_event("startup")` decorator** — `lifespan` is the
current, correct pattern; many older tutorials still show the deprecated form.

## GPU-aware Dockerfiles — see `gpu_containers.md` for the full pattern

For a quick preview, the key difference is the base image:

```dockerfile
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04
# ... rest of the multi-stage pattern still applies
```

## Reducing image size further

```dockerfile
# Use a slim or distroless base rather than a full OS image
FROM python:3.12-slim          # good default
# FROM gcr.io/distroless/python3  # even smaller, but harder to debug (no shell)

# Combine RUN instructions to reduce layer count where sensible
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*   # clean up apt cache in the SAME layer
```

Cleaning up package manager caches **in the same `RUN` instruction** matters —
cleaning them in a later, separate instruction doesn't reduce the image size, since
earlier layers are already committed and immutable.

## Health check endpoint — needed by both Docker and Kubernetes

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

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD curl -f http://localhost:8000/health || exit 1
```

Docker's own `HEALTHCHECK` is useful for standalone container deployments;
Kubernetes uses its own probe mechanism against the same endpoints (see
`probes_and_healing.md`) rather than relying on the Docker-level healthcheck once
you're in a cluster.

## Complete example: a production-shaped ML serving Dockerfile

```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

COPY artifacts/ ./artifacts/
COPY app/ ./app/

RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Practical guidance

1. **Always multi-stage build** — separate build-time and runtime dependencies as
   the default, not an optimization for later.
2. **Pin exact ML library versions**, matching training environment exactly — this
   single practice prevents the most common ML container failure.
3. **Bake models into the image by default**; move to runtime download only for
   genuinely large models or frequent model swaps without redeploys.
4. **Use the FastAPI `lifespan` pattern for model loading**, never `on_event` or
   per-request loading.
5. **Run as a non-root user** in the final image — a real, cheap security practice.
6. **Expose `/health` and `/ready` as separate endpoints** — Kubernetes needs both
   (see `probes_and_healing.md`), and the distinction (alive vs. actually ready to
   serve) matters most exactly when a large model is still loading.