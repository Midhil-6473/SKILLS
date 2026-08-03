---
name: docker-k8s-mlops
description: >
  Complete architect's manual for containerizing and deploying ML/DL/AI applications
  with Docker and Kubernetes — the MLOps layer that turns a working model or agent
  into a reliable, scalable production service. Use whenever the user asks about
  Dockerizing a model or app, writing a Dockerfile for ML/Python services, GPU
  containers (NVIDIA Container Toolkit, CUDA base images), docker-compose for local
  multi-service ML stacks, Kubernetes concepts (Pods, Deployments, Services, Ingress),
  health checks (liveness/readiness/startup probes), autoscaling (HPA), GPU scheduling
  on Kubernetes, model serving frameworks (KServe, Seldon, BentoML, Triton), CI/CD for
  ML, or general MLOps deployment/production questions. Also trigger for beginner
  questions like what a container is, why Docker matters for ML, Docker vs Kubernetes,
  or how to take a model from a notebook to a live production endpoint.
---

# The Docker + Kubernetes MLOps Architect's Manual

You are acting as an expert MLOps/platform engineer. This skill covers the gap
between "a model that works in a notebook" and "a model serving live traffic
reliably" — roughly 87% of ML models never cross that gap, and it is a packaging-
and-operations problem, not a modeling problem. This skill is that missing layer
underneath every ML/DL/agentic application you build.

## The linear flow, regardless of framework

```
Train model → save artifact → wrap in a small web service (FastAPI/Flask) that
loads the artifact once → bake service + artifact into a Docker image → push to a
registry → Kubernetes pulls the image, runs replicas behind a Service, watches
health, scales under load
```

This flow is identical whether you're serving a scikit-learn classifier, a PyTorch
vision model, or an LLM-based agent — only the image size, health-check timing, and
resource requests change.

## Docker vs. Kubernetes — the one-line distinction

> **Docker packages an application. Kubernetes scales and manages many packaged
> applications reliably across machines.**

Docker alone answers "how do I make this run the same way everywhere?" Kubernetes
answers "how do I keep N replicas of this healthy, load-balanced, and self-healing
under real, variable traffic, across a cluster of machines?" You need Docker on
every project; you need Kubernetes once a single container on a single host is no
longer enough (multiple replicas, self-healing, autoscaling, zero-downtime
deploys, multiple services that need to discover each other).

**Honest guidance on when *not* to reach for Kubernetes:** if you're serving a
single model at low or steady traffic, a Docker container on a managed platform
(Cloud Run, a single VM, a serverless container service) is cheaper and simpler to
run than a Kubernetes cluster. Reach for Kubernetes when you have real multi-service
complexity, need autoscaling under variable load, or your organization already
operates a cluster.

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Docker fundamentals: images, containers, layers, why containerization matters for ML reproducibility | `references/docker_fundamentals.md` |
| Writing production Dockerfiles for ML/AI apps: multi-stage builds, dependency pinning, image size, FastAPI lifespan-based model loading | `references/dockerfiles_for_ml.md` |
| GPU containers: NVIDIA Container Toolkit, CUDA base images, `--gpus` flag, GPU-enabled Dockerfiles | `references/gpu_containers.md` |
| docker-compose for local multi-service ML stacks (API + DB + Redis + training) | `references/docker_compose.md` |
| Kubernetes core concepts: Pods, Deployments, Services, Ingress, ConfigMaps/Secrets, namespaces | `references/kubernetes_fundamentals.md` |
| Health checks and self-healing: liveness/readiness/startup probes, rolling updates | `references/probes_and_healing.md` |
| Autoscaling: HPA (autoscaling/v2), scaling ML inference under load, common pitfalls | `references/autoscaling.md` |
| GPU scheduling on Kubernetes: device plugin, resource requests, node pools, Kueue for GPU quotas | `references/gpu_on_kubernetes.md` |
| Model-serving frameworks: KServe, Seldon Core, BentoML, Triton — when to use a framework vs. a plain Deployment | `references/model_serving_frameworks.md` |
| CI/CD and GitOps for ML: registries, image tagging/versioning, Argo CD, automated rollouts and rollbacks | `references/cicd_and_gitops.md` |
| Monitoring and drift: Prometheus/Grafana, Evidently, connecting to the observability layer | `references/monitoring_and_drift.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Always use multi-stage Docker builds for ML images.** Separate build-time
   dependencies (compilers, dev headers) from the runtime image — this is the single
   biggest lever against 1.5GB+ images that are slow to pull and slow to scale.
2. **Pin exact dependency versions, especially ML libraries.** A `model.pkl` that
   won't load in the container is very often a scikit-learn/PyTorch version mismatch
   between training and serving environments — pin to the exact versions used at
   training time.
3. **Load models once at process startup, never per-request** — inside a container
   this is the same FastAPI `lifespan` pattern as any other deployment, but the
   consequence of getting it wrong (re-loading a multi-GB model per request) is far
   more visible in a containerized/scaled environment.
4. **Every container serving real traffic needs a liveness probe and a readiness
   probe** — this is what makes "it just restarts itself" actually true, and it's
   what keeps traffic away from a pod whose model hasn't finished loading yet.
5. **Set `initialDelaySeconds` generously for ML services** — model load time is
   often the slowest part of startup; an impatient liveness probe will kill a
   container that's still loading weights, causing a `CrashLoopBackOff` death spiral.
6. **Set resource `requests` on every container**, especially before enabling HPA —
   without CPU/memory requests, Kubernetes can't compute utilization and autoscaling
   silently fails to trigger.
7. **For LLM/GPU-heavy serving, don't reach for a raw Deployment** — use a
   purpose-built serving framework (KServe's vLLM runtime, Triton, BentoML) that
   already solves batching, GPU sharing, and scale-to-zero for you.
8. **Secrets never go in the image or in plaintext manifests** — use Kubernetes
   Secrets (or better, an external secrets manager) and never commit credentials to
   the repository, containerized or not.
9. **Source of truth:** `docs.docker.com` and `kubernetes.io/docs`. The Kubernetes-
   native MLOps tool layer (KServe, Kubeflow Trainer, Kueue) moves fast — each ships
   its own operator/CRDs with version-specific install steps, so web-search current
   install guides rather than assuming a remembered one-liner still works.