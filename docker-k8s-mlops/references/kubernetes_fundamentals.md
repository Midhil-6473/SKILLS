# Kubernetes Fundamentals — Pods, Deployments, Services, Ingress

## Why Kubernetes exists (the concrete failure modes it solves)

Picture a single Docker container serving a model on one host: three users hit it
at once and the single process falls over. A node reboots and wipes the in-memory
model, triggering a 40-minute reload. There's no automatic recovery, no load
distribution across replicas, no way to update the running version without
downtime. Kubernetes exists to solve exactly these problems: **GPU/resource
scheduling across many machines, elastic serving under variable load, and
reproducible, low-risk rollouts and rollbacks.**

## The core object hierarchy

```
Deployment  (declares: "I want N replicas of this Pod spec, always")
   └── ReplicaSet (auto-managed by the Deployment — ensures N Pods exist)
         └── Pod  (one or more containers, the smallest deployable unit)
               └── Container (your Docker image, running)

Service     (a stable network identity + load balancer in front of a set of Pods)
Ingress     (routes external HTTP traffic to Services, based on host/path rules)
```

## Pods — the smallest deployable unit

A Pod wraps one or more containers that share networking and storage — in practice,
**one container per Pod is the overwhelmingly common pattern** for ML serving
(a "sidecar" container, e.g. for logging, is the main exception). You almost never
create a bare Pod directly in production — you create a **Deployment**, which
creates and manages Pods for you.

## Deployments — declarative, self-healing replica management

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: model-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: model-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app: model-api
    spec:
      containers:
        - name: model-api
          image: myregistry.io/model-api:v1.2.0
          ports:
            - containerPort: 8000
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
```

```bash
kubectl apply -f deployment.yaml
kubectl get deployments
kubectl get pods -l app=model-api
kubectl rollout status deployment/model-api
kubectl rollout undo deployment/model-api   # instant rollback to the previous version
```

**`resources.requests`** is what the scheduler uses to decide which node has room
for this Pod, and — critically — what HPA needs to compute utilization percentages
for autoscaling (see `autoscaling.md`). **`resources.limits`** caps actual usage;
exceeding a memory limit gets a container OOM-killed, exceeding a CPU limit gets
it throttled.

### Rolling updates — zero-downtime deploys

`maxUnavailable: 1, maxSurge: 1` means: during a rollout, at most 1 old Pod goes
down and at most 1 extra new Pod comes up at a time, keeping the service available
throughout. This is what makes deploying a new model version routine instead of
risky — combined with `kubectl rollout undo` for an instant one-command rollback if
the new version misbehaves.

## Services — stable networking for a moving set of Pods

Pods are ephemeral — they get recreated (with new IPs) on every rollout or
restart. A **Service** provides a stable DNS name and IP that load-balances across
whichever Pods currently match its label selector, regardless of individual Pod
churn.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: model-api
spec:
  selector:
    app: model-api      # routes to any Pod with this label — matches the Deployment above
  ports:
    - port: 80
      targetPort: 8000
  type: ClusterIP        # internal-only by default
```

| Service type | Exposes to |
|---|---|
| `ClusterIP` (default) | Internal cluster traffic only |
| `NodePort` | Each node's IP on a static port — simple external access, rarely used directly in production |
| `LoadBalancer` | Provisions a cloud load balancer (AWS/GCP/Azure) — the standard way to expose a service externally on a managed cluster |

## Ingress — routing external HTTP traffic by host/path

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: model-api-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: model-api
                port:
                  number: 80
```

An Ingress sits in front of one or more Services, handling host/path-based routing,
TLS termination, and giving you a single external entry point instead of a separate
`LoadBalancer` Service per microservice — the standard pattern once you have more
than one service to expose externally.

## ConfigMaps and Secrets — configuration and credentials

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: model-api-config
data:
  LOG_LEVEL: "info"
  MODEL_VERSION: "v1.2.0"
---
apiVersion: v1
kind: Secret
metadata:
  name: model-api-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@db:5432/mydb"
```

```yaml
# Referenced in a Deployment's container spec:
envFrom:
  - configMapRef:
      name: model-api-config
  - secretRef:
      name: model-api-secrets
```

**Never commit a Secret manifest with real values to a Git repository** — use
`kubectl create secret` imperatively, a sealed-secrets/external-secrets operator,
or your cloud provider's native secrets integration, rather than plaintext YAML in
version control. Kubernetes Secrets are base64-**encoded**, not encrypted, by
default — treat them as sensitive-but-not-cryptographically-protected unless you've
configured encryption at rest.

## Namespaces — logical isolation within a cluster

```bash
kubectl create namespace ml-staging
kubectl apply -f deployment.yaml -n ml-staging
kubectl get pods -n ml-staging
```

Namespaces partition a cluster's resources (commonly by environment — `dev`,
`staging`, `production` — or by team) for organization, access control (via RBAC),
and resource quotas, without needing separate clusters.

## Essential `kubectl` commands

```bash
kubectl get pods                          # list pods
kubectl describe pod <pod-name>           # detailed status, events — the first debugging step
kubectl logs <pod-name>                   # view container logs
kubectl logs <pod-name> -f                # follow logs live
kubectl exec -it <pod-name> -- bash       # shell into a running pod
kubectl apply -f manifest.yaml            # create/update resources declaratively
kubectl delete -f manifest.yaml           # remove resources
kubectl get events --sort-by=.lastTimestamp   # cluster-wide recent events, useful for debugging
```

`kubectl describe pod` and `kubectl logs` are the first two commands to reach for
whenever a pod isn't behaving as expected — `describe` shows scheduling and probe
failures, `logs` shows what the application itself printed.

## Practical guidance

1. **Always deploy via a Deployment, never a bare Pod**, for anything meant to
   survive a restart or scale beyond one replica.
2. **Set `resources.requests` and `resources.limits` on every container** — this is
   a prerequisite for both correct scheduling and working autoscaling, not optional
   tuning.
3. **Use a Service for stable internal networking, an Ingress for external HTTP
   routing** — don't expose every service via its own `LoadBalancer`.
4. **Never commit real Secret values to version control** — treat Kubernetes
   manifests the same way you'd treat any other code that might touch credentials.
5. **`kubectl describe` and `kubectl logs` first**, always, when debugging — resist
   the urge to guess before checking what the cluster itself is reporting.