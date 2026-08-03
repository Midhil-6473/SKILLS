# Beginner → Advanced Learning Path (Docker + Kubernetes for MLOps)

Use this as a curriculum when the user wants a structured roadmap rather than a
point answer. Each phase names the reference file(s) to pull detail from, and
builds on one cumulative project: **containerizing and deploying a simple ML
model API**, growing more production-shaped at each phase.

## Phase 0 — Orientation (15 minutes)

- Understand the linear flow: train → save artifact → wrap in a web service →
  containerize → push to a registry → orchestrate. See `SKILL.md`.
- Understand the one-line Docker vs. Kubernetes distinction, and when Kubernetes
  is (and isn't) actually warranted.
- Install Docker Desktop (or Docker Engine) locally.

**Practice:** Run `docker run hello-world` and confirm Docker works.

## Phase 1 — Docker Fundamentals

*Read: `docker_fundamentals.md`*

1. Understand images vs. containers, and layer caching.
2. Write a `.dockerignore` for a small Python project.
3. Build and run a trivial containerized FastAPI "hello world" app.
4. Push it to a registry (Docker Hub is fine for practice).

**Practice project:** Containerize a minimal FastAPI app with one endpoint,
confirm it runs identically via `docker run` regardless of your host setup.

## Phase 2 — Production Dockerfiles for ML

*Read: `dockerfiles_for_ml.md`*

1. Convert a single-stage Dockerfile into a multi-stage build; compare image
   sizes before/after.
2. Pin every dependency in `requirements.txt` to exact versions.
3. Add the FastAPI `lifespan` model-loading pattern (load once, not per-request).
4. Add `/health` and `/ready` endpoints.

**Practice project:** Containerize a real scikit-learn model behind a FastAPI
`/predict` endpoint, using a multi-stage build, pinned dependencies, and both
health endpoints.

## Phase 3 — docker-compose for Local Multi-Service Stacks

*Read: `docker_compose.md`*

1. Add a Postgres service alongside your model API in a `docker-compose.yml`.
2. Use `depends_on` with `condition: service_healthy` correctly.
3. Try Compose profiles to separate a "serving" stack from a "training" stack.

**Practice project:** Extend your Phase 2 model API to log predictions to a
Postgres database, both running via a single `docker compose up`.

## Phase 4 — Kubernetes Fundamentals

*Read: `kubernetes_fundamentals.md`*

1. Set up a local cluster (minikube or kind) for practice.
2. Write a Deployment manifest for your Phase 2 model API image.
3. Expose it via a Service; access it via `kubectl port-forward` or a
   `LoadBalancer`/`NodePort`.
4. Practice `kubectl describe`, `kubectl logs`, and `kubectl exec` for debugging.
5. Add a ConfigMap and a Secret, referenced by the Deployment.

**Practice project:** Deploy your model API to a local Kubernetes cluster with 2
replicas behind a Service, and verify requests load-balance across both.

## Phase 5 — Health Checks & Self-Healing

*Read: `probes_and_healing.md`*

1. Add liveness, readiness, and startup probes to your Deployment.
2. Deliberately break the readiness endpoint and observe traffic get routed
   away without a restart.
3. Deliberately hang the liveness endpoint and observe a restart.
4. Simulate a slow model load and confirm the startup probe prevents a
   `CrashLoopBackOff`.

**Practice project:** Add an artificial delay to your model-loading code,
confirm your probes are configured correctly so the pod doesn't crash-loop
during that delay.

## Phase 6 — Autoscaling

*Read: `autoscaling.md`*

1. Install the Metrics Server on your local cluster.
2. Add `resources.requests` to your Deployment (a prerequisite HPA needs).
3. Create an HPA scaling on CPU utilization.
4. Generate load (e.g., with `hey` or `ab`) and watch `kubectl get hpa -w` scale
   replicas up, then back down.

**Practice project:** Load-test your deployed model API and observe HPA scale
your replica count up under load and back down afterward.

## Phase 7 — GPU Containers & GPU Scheduling (if applicable)

*Read: `gpu_containers.md` + `gpu_on_kubernetes.md`*

1. Containerize a PyTorch model with a matching CUDA base image.
2. Run it locally with `--gpus all` and verify GPU access.
3. If you have access to a GPU-enabled cluster, request `nvidia.com/gpu` in a
   pod spec and confirm scheduling.

**Practice project:** Containerize a small PyTorch model, confirm GPU inference
works both via plain `docker run --gpus all` and (if available) on a GPU node
in Kubernetes.

## Phase 8 — Model Serving Frameworks

*Read: `model_serving_frameworks.md`*

1. Compare your hand-rolled Deployment against what KServe's `InferenceService`
   would give you for the same model.
2. If working with an LLM, look specifically at KServe's vLLM runtime.
3. Understand when Seldon/BentoML/Triton would be the better fit than KServe.

**Practice:** Read through a KServe `InferenceService` example for your model
type and identify which parts of your Phase 4-6 manual setup it would replace.

## Phase 9 — CI/CD and GitOps

*Read: `cicd_and_gitops.md`*

1. Write a CI pipeline (GitHub Actions or equivalent) that builds, tests, and
   pushes your model API image on every commit to main.
2. Add a model-loading sanity-check step to CI.
3. If accessible, set up Argo CD pointing at a manifests repo, and practice a
   `git revert`-based rollback.

**Practice project:** Get a full pipeline working: push code → CI builds and
tags an image → (manually or via GitOps) the cluster picks up the new version
via a rolling update.

## Phase 10 — Monitoring and Drift

*Read: `monitoring_and_drift.md`*

1. Expose Prometheus metrics from your model API (request count, latency,
   errors).
2. Set up a basic Grafana dashboard against those metrics.
3. Run a simple Evidently drift report comparing two synthetic datasets.

**Practice project:** Add Prometheus metrics and a scheduled (CronJob) drift
check to your deployed model API — the final, most production-shaped version of
the project you've been building since Phase 2.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer with
a specific production task):
- Build one cumulative project across all phases rather than disconnected
  examples — by Phase 10 it should be a genuinely production-shaped deployment.
- Use minikube or kind for all Kubernetes practice — no cloud cluster is needed
  to learn the core concepts, and this removes cost as a barrier.
- Check understanding with a quick, deliberate failure before advancing — e.g.,
  "before moving to autoscaling, want to try killing a pod manually and watching
  the Deployment recreate it?" Seeing self-healing happen live is more
  memorable than reading about it.
- Flag clearly when something is a genuinely advanced/optional concern (Kueue,
  MIG GPU partitioning, Seldon's licensing) vs. core material everyone building
  ML services should know.