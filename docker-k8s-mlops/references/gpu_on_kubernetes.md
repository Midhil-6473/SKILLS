# GPU Scheduling on Kubernetes

## The core mechanism: the NVIDIA device plugin

Kubernetes doesn't understand GPUs natively — a cluster needs the **NVIDIA device
plugin** (a DaemonSet running on every GPU node) installed before any Pod can
request GPU resources. Once installed, GPUs become a schedulable resource
(`nvidia.com/gpu`) exactly like CPU or memory.

```bash
# Typical install (exact steps depend on your cluster/cloud provider — check current docs)
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/main/deployments/static/nvidia-device-plugin.yml
```

Managed Kubernetes offerings (GKE, EKS, AKS) with GPU node pools typically handle
device plugin installation automatically when you provision GPU-enabled nodes —
verify with your specific provider's documentation rather than assuming manual
installation is needed.

## Requesting a GPU in a Pod spec

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gpu-model-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: gpu-model-api
  template:
    metadata:
      labels:
        app: gpu-model-api
    spec:
      containers:
        - name: model-api
          image: myregistry.io/gpu-model-api:v1
          resources:
            requests:
              nvidia.com/gpu: 1
            limits:
              nvidia.com/gpu: 1     # requests and limits MUST match for GPUs
```

**GPU resource requests and limits must be equal** — unlike CPU/memory, GPUs
aren't fractionally shareable by default in standard Kubernetes scheduling
(a Pod either gets a whole GPU or it doesn't), so `requests` and `limits` for
`nvidia.com/gpu` are always set to the same value.

## Node selection — ensuring GPU workloads land on GPU nodes

```yaml
spec:
  template:
    spec:
      nodeSelector:
        cloud.google.com/gke-accelerator: nvidia-tesla-t4   # cloud-provider-specific label
      tolerations:
        - key: "nvidia.com/gpu"
          operator: "Exists"
          effect: "NoSchedule"
```

GPU nodes are typically tainted (to prevent non-GPU workloads from accidentally
consuming expensive GPU node capacity) — GPU-requesting Pods need a matching
`toleration` to be schedulable onto them, plus a `nodeSelector`/node affinity rule
matching your cloud provider's GPU node labels.

## Why GPU cost control matters — and Kueue

GPUs are the most expensive line item in most ML infrastructure budgets, and
naive scheduling (each team/job reserving GPUs it may not constantly use) leads to
idle, reserved-but-unused GPU capacity — a very real, quietly expensive waste
pattern. **Kueue** addresses this by enforcing quotas and queueing GPU jobs so idle
GPU capacity gets reused across teams/jobs rather than sitting reserved by whoever
grabbed it first.

```yaml
# Simplified conceptual shape — exact CRDs depend on your Kueue version;
# consult Kueue's official install/config guide for your cluster
apiVersion: kueue.x-k8s.io/v1beta1
kind: ResourceFlavor
metadata:
  name: gpu-flavor
---
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata:
  name: ml-team-queue
spec:
  resourceGroups:
    - coveredResources: ["nvidia.com/gpu"]
      flavors:
        - name: gpu-flavor
          resources:
            - name: "nvidia.com/gpu"
              nominalQuota: 4
```

Kueue is worth adopting once multiple teams or job types compete for a shared,
limited pool of GPUs — for a single team with dedicated GPU nodes, plain resource
requests/limits are often sufficient without adding Kueue's additional complexity.

## Scale-to-zero for intermittently-used GPU models

The single biggest GPU cost-control win for many organizations is **scale-to-zero**
on rarely-called models — rather than keeping a GPU replica running (and billed)
permanently for a model called a handful of times a day, scale to zero replicas
when idle and cold-start on demand.

```bash
# KEDA (Kubernetes Event-Driven Autoscaling) is the standard tool for scale-to-zero,
# scaling based on external event sources (queue depth, HTTP request rate) down to
# zero replicas — something plain HPA cannot do (HPA's minReplicas floor is 1+)
```

Both **KEDA** (general-purpose scale-to-zero based on event sources) and **KServe**
(purpose-built for model serving, with native scale-to-zero support — see
`model_serving_frameworks.md`) solve this; KServe is the more direct fit
specifically for model-serving workloads.

## GPU sharing strategies (advanced)

For workloads that don't need a full GPU each (e.g., many small models), several
mechanisms allow multiple Pods to share a single physical GPU:
- **Time-slicing** — multiple Pods take turns on the same GPU, configured via the
  device plugin.
- **Multi-Instance GPU (MIG)** — hardware-level partitioning available on newer
  NVIDIA data-center GPUs (A100/H100-class), giving genuinely isolated GPU slices.

These are meaningfully more complex to configure correctly than whole-GPU
scheduling — reach for them only once whole-GPU allocation is demonstrably wasteful
for your actual workload shapes (many small models, each far under a full GPU's
capacity).

## Distributed training on Kubernetes

For training jobs spanning multiple GPUs/nodes (rather than single-node serving),
the current standard is the **Kubeflow Trainer**'s unified `TrainJob` API — the
older, framework-specific `PyTorchJob`/`TFJob` CRDs are now considered legacy in
favor of this unified approach. Training is a declarative, schedulable Job in this
model — not something that depends on one person's laptop, one Jupyter kernel's
state, or an undocumented sequence of manual `pip install` commands, which is
exactly the reproducibility problem Kubernetes-native training solves.

## Practical guidance

1. **Verify the NVIDIA device plugin is installed** before debugging why GPU
   requests aren't scheduling — this is the first thing to check on a new cluster.
2. **Always set `requests` and `limits` equal for `nvidia.com/gpu`.**
3. **Configure `nodeSelector`/`tolerations` matching your GPU node pool** — a GPU
   request alone doesn't guarantee correct node placement without this.
4. **Adopt Kueue once multiple teams/jobs compete for shared GPU capacity** — not
   needed for a single team with dedicated nodes.
5. **Use scale-to-zero (via KServe or KEDA) for intermittently-called models** —
   this is typically the single largest lever for controlling GPU spend.
6. **For distributed training, use Kubeflow Trainer's `TrainJob`**, not the legacy
   `PyTorchJob`/`TFJob` CRDs.