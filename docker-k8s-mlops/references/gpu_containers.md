# GPU Containers — NVIDIA Container Toolkit, CUDA Base Images

## Why GPU containers need special handling

A normal Docker container has no access to the host's GPU by default — GPU access
requires the **NVIDIA Container Toolkit** installed on the host, plus explicit
GPU access flags/resource requests when running the container. This is true whether
you're running locally with `docker run` or scheduling on a Kubernetes cluster.

## Prerequisites on the host

- A compatible NVIDIA GPU driver installed on the host machine (not inside the
  container — the driver stays on the host; only CUDA/cuDNN userspace libraries
  live inside the container).
- The **NVIDIA Container Toolkit** installed on the host, which lets Docker's
  runtime expose GPU devices to containers.

```bash
# Verify the toolkit is working — should print GPU info from inside a container
docker run --rm --gpus all nvidia/cuda:12.4.0-runtime-ubuntu22.04 nvidia-smi
```

## Running a GPU container locally

```bash
docker run --rm --gpus all my-pytorch-app:v1
docker run --rm --gpus '"device=0,1"' my-pytorch-app:v1   # specific GPUs only
```

The `--gpus all` flag gives explicit, direct GPU access — the standard approach for
local development, experimentation, and single-node training.

## GPU-aware Dockerfile — CUDA base images

```dockerfile
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04 AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# Install PyTorch with the matching CUDA version — critical detail
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cu124

COPY . .
CMD ["python3", "serve.py"]
```

**Match the CUDA version in your base image to the CUDA version your ML framework
was built against** — a mismatch here is a very common source of cryptic runtime
errors (`CUDA driver version is insufficient`, or silent CPU fallback with no
error at all). `nvidia/cuda:12.4.0-runtime-...` pairs with a PyTorch build
compiled against CUDA 12.4, as reflected in the `--extra-index-url` above.

### `runtime` vs. `devel` CUDA base image variants

| Variant | Contains | Use for |
|---|---|---|
| `nvidia/cuda:X.Y.Z-runtime-*` | CUDA runtime libraries only | Serving/inference — the smaller, correct choice for production images |
| `nvidia/cuda:X.Y.Z-devel-*` | Runtime libraries + compilers + headers | Building custom CUDA kernels/extensions — not needed for standard PyTorch/TF inference |

Use `runtime` variants for the final image in a multi-stage build; reach for
`devel` only in a build stage if you're compiling custom CUDA code, and never ship
`devel` as your final runtime image — it's needlessly large for inference.

## Multi-stage GPU builds

```dockerfile
# Build stage (if compiling anything custom)
FROM nvidia/cuda:12.4.0-devel-ubuntu22.04 AS builder
# ... compile custom CUDA extensions if needed

# Runtime stage — smaller, no compilers
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04
COPY --from=builder /path/to/compiled/artifacts /app/
# ... rest of the app
```

The same multi-stage principle from `dockerfiles_for_ml.md` applies here, with GPU
base images specifically — the size difference between `devel` and `runtime`
variants makes this even more consequential than in a CPU-only image.

## Practical differences vs. CPU-only ML containers

Three things change for GPU-serving containers specifically:

1. **Image size and base image** — you need a CUDA-compatible base image (larger
   than a plain `python:slim`), making multi-stage builds even more valuable.
2. **GPU resource requests** — locally via `--gpus`, on Kubernetes via
   `nvidia.com/gpu: 1` in the pod spec (see `gpu_on_kubernetes.md`) — the cluster
   also needs the NVIDIA device plugin installed for this to work.
3. **Model load time is longer** — GPU weight loading (especially for large
   models) takes meaningfully longer than typical CPU model loading. Set
   `initialDelaySeconds` generously on any readiness probe, and lean on the
   readiness probe specifically to keep traffic away from a pod until weights have
   fully loaded (see `probes_and_healing.md`).

## For LLMs specifically: skip raw Deployments

For large language model serving specifically, don't hand-roll a raw Kubernetes
Deployment with a custom inference script — use a purpose-built serving runtime
(e.g., KServe's vLLM runtime, or NVIDIA Triton) that already solves continuous
batching, KV-cache management, and multi-GPU sharding correctly. See
`model_serving_frameworks.md`.

## Practical guidance

1. **Install the NVIDIA Container Toolkit on the host** before anything else — this
   is a host-level prerequisite, not something a Dockerfile can solve.
2. **Match your CUDA base image version to your ML framework's expected CUDA
   version exactly** — this single mismatch causes most GPU container failures.
3. **Use `runtime` CUDA variants for final images, `devel` only in build stages**
   (or not at all, for standard PyTorch/TF inference with no custom kernels).
4. **Set generous `initialDelaySeconds`** on any health probe wrapping a GPU model
   service — GPU weight loading is slower than most CPU model loading.
5. **For LLM serving specifically, reach for a dedicated serving framework** rather
   than a hand-rolled inference script in a raw container.