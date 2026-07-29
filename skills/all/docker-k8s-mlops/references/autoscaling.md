# Autoscaling — HPA for ML Inference Under Variable Load

## Why autoscale ML inference specifically

Inference traffic is often spiky and unpredictable — a batch job kicks off, a
product feature launches, or usage simply follows normal daily/weekly cycles.
Fixed replica counts force a choice between over-provisioning (paying for idle
capacity most of the time — fleet-wide average CPU utilization across production
Kubernetes clusters is commonly reported around 8%) or under-provisioning (getting
overwhelmed during real peaks). **Horizontal Pod Autoscaling (HPA)** removes that
choice by making replica count dynamic, reactive to actual load.

## HPA basics — `autoscaling/v2`

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: model-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: model-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
```

```bash
kubectl apply -f hpa.yaml
kubectl get hpa -w              # watch scaling decisions live
kubectl describe hpa model-api-hpa   # see current metrics and recent scaling events
```

**Always use `autoscaling/v2`, not the deprecated `autoscaling/v1`** — v1 supports
only a single CPU metric and lacks multi-metric support, stabilization windows, and
fine-grained scaling behavior tuning. Migrate any old v1 manifests you encounter.

## Prerequisite: the Metrics Server

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl top pods    # verify it's working — should show live CPU/memory usage
```

HPA cannot function without a running Metrics Server (or a custom metrics adapter)
providing live resource usage data.

## Prerequisite: `resources.requests` on the target Deployment

```yaml
containers:
  - name: model-api
    resources:
      requests:
        cpu: "250m"      # REQUIRED for HPA to compute a utilization percentage
      limits:
        cpu: "1000m"
```

**HPA cannot scale without `resources.requests.cpu` set on every container in the
target Deployment** — utilization is computed as *current usage ÷ requested
amount*; without a request, there's no denominator, and HPA silently fails to
scale (not an error — it just never triggers). This is the single most common
reason HPA "doesn't work."

## Scaling on memory, or multiple metrics at once

```yaml
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70
```

With multiple metrics, HPA computes a desired replica count for **each** metric
independently and scales to the **largest** of those recommendations — i.e., it
errs toward having enough capacity to satisfy whichever metric is most demanding.

## Scaling on custom metrics — useful for ML-specific signals

```yaml
metrics:
  - type: Pods
    pods:
      metric:
        name: inference_queue_depth
      target:
        type: AverageValue
        averageValue: "10"
```

CPU utilization is a poor proxy for load on many ML services — a GPU-bound model
might show low CPU usage while genuinely overloaded, or a request queue might be
backing up before CPU visibly spikes. Custom metrics (requests/sec, queue depth,
GPU utilization via a custom exporter) via the custom metrics API give HPA a
signal that actually reflects real service load, at the cost of needing a metrics
adapter set up to expose that signal to the HPA controller.

## Scaling behavior tuning — stabilization windows

```yaml
spec:
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300   # default — wait 5 min of sustained low load before scaling down
    scaleUp:
      stabilizationWindowSeconds: 0     # default — scale up immediately, no hesitation
```

This asymmetry is intentional: **be aggressive about adding capacity, conservative
about removing it.** HPA maintains a rolling window of past scaling
recommendations; for scale-down it uses the *maximum* recommendation seen in the
window (preventing premature scale-in from a brief dip), while scale-up uses the
*minimum* (acting on load increases immediately). Rarely worth overriding the
defaults without a specific, observed flapping problem.

## Common pitfall: pod warm-up throwing off metrics

A newly-scheduled Pod isn't immediately useful if it has a slow startup (model
loading, cache population) — but by default its metrics start counting almost
immediately, which can distort the utilization signal HPA is reacting to. Two
mitigations, both already covered in `probes_and_healing.md`:

- Configure a `startupProbe` so the Pod isn't considered "Ready" (and therefore
  isn't included in metric averaging) until it's actually finished initializing.
- Kubernetes also excludes newly-created pods from metric averaging for a short
  window automatically (tunable cluster-wide), specifically to reduce this effect.

## Common pitfall: HPA + Vertical Pod Autoscaler (VPA) conflict

Running HPA and VPA on the **same metric** (e.g., both reacting to CPU) creates a
feedback loop: VPA raises a Pod's CPU request, which — with usage unchanged —
makes utilization *appear* to drop, causing HPA to scale down; fewer Pods then
handle the same traffic, CPU usage climbs back up, and VPA raises requests again,
repeating indefinitely. **If using both, put VPA in `Recommend` mode only** (it
surfaces suggested requests without automatically applying them) rather than
`Auto` mode when HPA is also active on the same resource metric — or scale HPA and
VPA on genuinely orthogonal metrics.

## Setting realistic `maxReplicas`

```yaml
maxReplicas: 10   # not unlimited — always cap this deliberately
```

Calculate your application's realistic maximum expected load and set `maxReplicas`
with some buffer, rather than leaving it effectively unbounded. HPA has no
intrinsic understanding of "this doesn't make business sense" — it will happily
scale toward `maxReplicas` in response to a traffic spike regardless of whether
that spike is legitimate demand, a misconfigured client retry-storming your API,
or an actual denial-of-service attempt. A deliberate cap is a cheap, important
guardrail.

## Practical guidance

1. **Always set `resources.requests.cpu`** on the target Deployment before
   enabling HPA — this is a hard prerequisite, not a suggestion.
2. **Use `autoscaling/v2`**, never the deprecated v1 API.
3. **Pair HPA with a properly-configured `startupProbe`** on ML services — without
   it, slow-starting pods distort the metrics HPA scales on.
4. **Consider custom metrics (queue depth, requests/sec) over plain CPU** for
   GPU-bound or otherwise CPU-utilization-misleading ML workloads.
5. **Never run HPA and VPA on the same metric in `Auto` mode simultaneously** —
   this produces a real, documented oscillation bug.
6. **Always set a deliberate, calculated `maxReplicas`** — don't leave it
   effectively unbounded.