# Docker Fundamentals — Images, Containers, and Why They Matter for ML

## What is a container? (starting from zero)

A **container** packages an application together with everything it needs to run —
code, runtime, system libraries, dependencies — into a single, portable unit that
runs identically regardless of the host machine. Unlike a virtual machine, a
container shares the host OS kernel, making it far lighter-weight (megabytes to run,
seconds to start) while still providing process and filesystem isolation.

## Why this matters specifically for ML

ML has a uniquely bad "works on my machine" problem: a model trained with
scikit-learn 1.3 pickled and loaded with scikit-learn 1.5 can silently misbehave or
fail outright; a specific CUDA/cuDNN/PyTorch version combination that works on your
GPU workstation may not exist on the deployment target; a `pip install` today
resolves different transitive dependency versions than the same command run six
months ago. **Containerizing an ML service freezes the entire dependency graph at
build time**, eliminating the single most common source of ML deployment delays:
environment mismatch between training/development and production.

## Images vs. containers — the core distinction

- An **image** is a read-only, layered template — the blueprint (built once from a
  `Dockerfile`, stored in a registry).
- A **container** is a running (or stopped) instance of an image — you can run many
  containers from the same image simultaneously, each with its own isolated
  filesystem writes and process space.

```bash
docker build -t my-model-api:v1 .     # build an image from a Dockerfile
docker run -p 8000:8000 my-model-api:v1   # run a container from that image
```

## Layers — why Dockerfile instruction order matters

Each instruction in a `Dockerfile` creates a new **layer**, cached independently.
Docker reuses cached layers for any instruction whose inputs haven't changed since
the last build — this is why instruction *order* in a Dockerfile is a real
performance decision, not just style:

```dockerfile
# Bad: any code change invalidates the pip install cache below it
COPY . .
RUN pip install -r requirements.txt

# Good: dependencies only reinstall when requirements.txt actually changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
```

Putting rarely-changing instructions (installing dependencies) *before*
frequently-changing ones (copying application code) means most rebuilds only redo
the fast, final `COPY` step instead of reinstalling every dependency from scratch.

## The core Docker CLI vocabulary

```bash
docker build -t <name>:<tag> .        # build an image from a Dockerfile
docker run <image>                     # start a container
docker run -d <image>                  # run detached (background)
docker run -p 8000:8000 <image>        # map host port 8000 to container port 8000
docker run -e API_KEY=xyz <image>      # inject an environment variable
docker run -v $(pwd)/data:/app/data <image>  # mount a host directory into the container
docker ps                              # list running containers
docker logs <container_id>             # view a container's stdout/stderr
docker exec -it <container_id> bash    # get an interactive shell inside a running container
docker stop <container_id>             # stop a running container
docker images                          # list local images
docker rmi <image>                     # remove an image
```

## `.dockerignore` — don't bake unnecessary files into your image

```
# .dockerignore
__pycache__/
*.pyc
.venv/
.git/
data/          # large datasets — mount as a volume, don't bake into the image
*.csv
notebooks/
.env           # never bake secrets into an image layer
```

Anything not excluded here gets copied into the build context and potentially into
the image — this is both a size concern (large datasets bloat the image) and a
security concern (`.env` files with real credentials should never end up baked into
an image layer, which persists in the image history even if later deleted).

## Registries — where images live between build and deploy

```bash
docker tag my-model-api:v1 myregistry.io/my-model-api:v1
docker push myregistry.io/my-model-api:v1

# On the deployment target:
docker pull myregistry.io/my-model-api:v1
```

A **registry** (Docker Hub, AWS ECR, Google Artifact Registry, GitHub Container
Registry) stores built images so they can be pulled onto any deployment target —
this is the handoff point between "I built an image locally" and "Kubernetes can
run this image on a cluster node it's never seen before."

## Practical guidance

1. **Order Dockerfile instructions from least-frequently-changed to
   most-frequently-changed** to maximize layer cache reuse across rebuilds.
2. **Always write a `.dockerignore`** — treat it as seriously as `.gitignore`.
3. **Never bake secrets, datasets, or credentials into an image** — inject secrets
   via environment variables at runtime, mount large data via volumes.
4. **Push to a registry as the standard handoff to any orchestrator** — Kubernetes
   nodes pull from a registry, they don't build images themselves.
5. **Think of containerization as solving the ML-specific "it worked in the
   notebook" problem directly** — this is the practical justification worth keeping
   in mind, not containerization for its own sake.