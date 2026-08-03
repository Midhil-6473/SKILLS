# Health Checks & Self-Healing — Liveness, Readiness, Startup Probes

## Why probes matter more for ML services than typical web apps

A typical stateless web API starts in well under a second. An ML service often
doesn't — loading a multi-GB model checkpoint, warming up a GPU, or establishing a
vector database connection can take anywhere from several seconds to a couple of
minutes. **Probes configured with defaults tuned for a typical fast-starting web
app will kill a perfectly healthy, still-loading ML service before it ever gets a
chance to serve a request** — this is the single most common Kubernetes-specific
mistake in ML deployments.

## The three probe types

| Probe | Question it answers | On failure |
|---|---|---|
| **Liveness** | "Is this container still alive/functioning?" | Kubernetes **restarts** the container |
| **Readiness** | "Is this container ready to serve traffic *right now*?" | Pod is **removed from Service endpoints** — no traffic routed, but **not restarted** |
| **Startup** | "Has this container finished its (possibly slow) initial startup?" | Blocks liveness/readiness checks from running until startup succeeds, then hands off to them |

**The critical distinction between liveness and readiness:** a failed readiness
probe just stops traffic to that Pod — the container keeps running, ready to
recover on its own or resume once whatever it's waiting on becomes available. A
failed liveness probe **restarts the container** — appropriate only when the
container is genuinely stuck/hung, not merely "not ready yet."

## A correctly-configured ML service

```yaml
containers:
  - name: model-api
    image: myregistry.io/model-api:v1.2.0
    ports:
      - containerPort: 8000
    startupProbe:
      httpGet:
        path: /health
        port: 8000
      failureThreshold: 30      # 30 * 10s = up to 5 minutes to finish starting
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /ready            # distinct endpoint — checks the model is actually loaded
        port: 8000
      periodSeconds: 10
      failureThreshold: 3
    livenessProbe:
      httpGet:
        path: /health
        port: 8000
      periodSeconds: 15
      failureThreshold: 3
```

```python
# The corresponding FastAPI endpoints (see dockerfiles_for_ml.md)
@app.get("/health")
async def health():
    return {"status": "ok"}          # process is alive — always returns 200 once running

@app.get("/ready")
async def ready():
    if "classifier" not in ml_models:
        raise HTTPException(503, "Model not loaded yet")
    return {"status": "ready"}       # only 200 once the model is actually usable
```

**Use two distinct endpoints, not one.** `/health` should return 200 as soon as
the process is running (for liveness — "is it alive at all"); `/ready` should
return 200 only once the model has actually finished loading and the service can
genuinely serve a request (for readiness). Using the same endpoint for both loses
this distinction and typically causes either premature traffic routing or
unnecessary restarts.

## The startup probe — solving the slow-start death spiral

**Without a startup probe:** imagine a model takes 45 seconds to load, but your
liveness probe has `initialDelaySeconds: 30`. At t=30s the liveness probe fires,
gets a failure response (still loading), and — after a few failed attempts —
kills the container. It restarts. Loading begins again, taking another 45 seconds.
Gets killed again. **`CrashLoopBackOff`** — an infinite loop that never actually
needed to happen, since the app was never actually broken, just slow to start.

**With a startup probe**, liveness and readiness checks are held off entirely
until the startup probe first succeeds — giving a slow-loading model as long as
`failureThreshold × periodSeconds` to finish initializing, without any risk of a
premature restart.

```yaml
startupProbe:
  httpGet:
    path: /health
    port: 8000
  failureThreshold: 30    # generous — GPU model loading can be slow
  periodSeconds: 10        # 30 × 10s = 5 minutes max startup allowance
```

## Probe configuration parameters

| Parameter | Meaning | Default |
|---|---|---|
| `initialDelaySeconds` | Wait this long before the *first* probe attempt | 0 |
| `periodSeconds` | How often to probe | 10 |
| `timeoutSeconds` | How long to wait for a probe response before counting it as failed | 1 |
| `successThreshold` | Consecutive successes needed to mark healthy (after having been unhealthy) | 1 |
| `failureThreshold` | Consecutive failures before taking action (restart for liveness, remove from Service for readiness) | 3 |

**Common mistake:** setting `timeoutSeconds` too low (the 1-second default) for a
probe endpoint that does real work (e.g., a `/ready` check that pings a database) —
under load, a slow-but-healthy response can get misclassified as a failure. Keep
probe endpoints themselves cheap and fast to answer; don't make `/ready` do
expensive work on every single poll.

## Probe types beyond HTTP

```yaml
livenessProbe:
  exec:
    command: ["cat", "/tmp/healthy"]     # command-based: exit code 0 = healthy
livenessProbe:
  tcpSocket:
    port: 8000                            # TCP-based: can it open a connection at all
```

HTTP GET is the standard choice for any service already speaking HTTP (which is
essentially every FastAPI/Flask ML service) — reach for `exec` or `tcpSocket` only
for non-HTTP workloads.

## How probes interact with rolling updates and scale-down

Kubernetes uses probe status to decide **which Pods to prefer terminating** during
a scale-down or rollout: a Pod already failing readiness/liveness checks is
prioritized for termination over a healthy, newer Pod — probes aren't just about
individual Pod health, they directly inform the cluster's higher-level scheduling
decisions.

## Practical guidance

1. **Always configure all three probes for ML services**, not just liveness —
   readiness in particular is what actually protects users from hitting a pod
   that's still loading.
2. **Use separate `/health` and `/ready` endpoints** — never conflate "alive" with
   "actually ready to serve."
3. **Set a generous `startupProbe`** for any service with meaningful load time
   (GPU models, large checkpoints) — this is the direct fix for the
   `CrashLoopBackOff` death spiral.
4. **Keep probe endpoints cheap** — don't do expensive work inside `/ready`; a
   simple flag check (`"classifier" in ml_models`) is sufficient and fast.
5. **Tune `periodSeconds`/`failureThreshold` deliberately**, not by leaving
   defaults tuned for typical fast-starting web apps on a service that behaves very
   differently.