# Model Serving Frameworks — KServe, Seldon Core, BentoML, Triton

## When to use a serving framework instead of a plain Deployment

A hand-rolled FastAPI service in a plain Kubernetes Deployment (everything covered
so far in this skill) is entirely sufficient for many projects — simple models,
moderate traffic, a small team. Reach for a dedicated serving framework once you
need capabilities that are genuinely hard to build correctly yourself: canary
rollouts between model versions, request batching for throughput, multi-framework
model support behind one interface, or — especially — **LLM-specific serving**
(continuous batching, KV-cache management) where a naive implementation performs
dramatically worse than a purpose-built runtime.

## KServe — the CNCF-standard model serving platform

KServe (a CNCF project) provides a Kubernetes-native `InferenceService` custom
resource abstracting away Deployment/Service/Ingress/HPA boilerplate specifically
for model serving, with built-in support for canary rollouts, scale-to-zero, and
multiple ML framework runtimes out of the box.

```yaml
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: sklearn-iris
spec:
  predictor:
    sklearn:
      storageUri: "gs://my-bucket/models/sklearn-iris/"
      resources:
        requests:
          cpu: "100m"
          memory: "256Mi"
```

```yaml
# LLM serving with KServe's vLLM runtime — the recommended path for LLMs specifically
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: llama-server
spec:
  predictor:
    model:
      runtime: kserve-vllm
      storageUri: "hf://meta-llama/Llama-3-8B"
      resources:
        requests:
          nvidia.com/gpu: 1
        limits:
          nvidia.com/gpu: 1
```

KServe supports **canary rollouts** natively — splitting traffic between a stable
and a candidate model version by percentage, without hand-building this routing
logic yourself:

```yaml
spec:
  predictor:
    canaryTrafficPercent: 10   # 10% of traffic to the new model version, 90% to stable
```

**For large language models specifically, skip raw Deployments entirely and use
KServe's vLLM runtime** — vLLM's continuous batching and PagedAttention KV-cache
management provide substantially better throughput and latency than a naive
"load the model, run `generate()` per request" FastAPI implementation.

## Seldon Core — advanced inference graphs

Seldon Core specializes in complex **inference graphs** — chaining
preprocessing → model → postprocessing → business-logic steps, or running
multiple models in an ensemble, as a single deployable unit with request tracing
across the whole graph. Notable licensing consideration: Seldon Core moved to an
open-core model — check current licensing terms for your use case (some advanced
features are commercial) before committing to it for a project.

```yaml
apiVersion: machinelearning.seldon.io/v1
kind: SeldonDeployment
metadata:
  name: fraud-detector
spec:
  predictors:
    - name: default
      graph:
        name: preprocessor
        children:
          - name: fraud-model
            children:
              - name: postprocessor
```

Reach for Seldon specifically when your serving need is a genuine **multi-step
graph** (not just a single model behind an endpoint) — for a single model, KServe
or a plain Deployment is simpler and sufficient.

## BentoML — Python-native packaging with broad framework support

BentoML focuses on packaging models with their preprocessing/postprocessing code
as a single deployable "Bento," with a lower-friction Python-native development
experience than writing Kubernetes YAML directly, while still deploying to
Kubernetes (or other targets) underneath.

```python
import bentoml

@bentoml.service(resources={"cpu": "2"})
class FraudDetector:
    model = bentoml.models.get("fraud-model:latest")

    @bentoml.api
    def predict(self, input_data: dict) -> dict:
        return {"fraud_score": self.model.predict(input_data)}
```

```bash
bentoml build
bentoml containerize fraud_detector:latest    # produces a Docker image
```

BentoML's appeal is developer experience — Python-native model packaging with
automatic Dockerfile/image generation — at the cost of an additional
framework-specific abstraction layer between you and the raw Kubernetes objects.

## Triton Inference Server — NVIDIA's high-performance multi-framework server

NVIDIA Triton serves models from multiple frameworks (TensorFlow, PyTorch, ONNX,
TensorRT) behind a single, highly optimized C++ inference server, with dynamic
batching and strong multi-GPU support — the standard choice when raw inference
throughput/latency on GPU is the primary concern, more so than developer
convenience.

```
model_repository/
└── fraud_model/
    ├── config.pbtxt
    └── 1/
        └── model.onnx
```

```bash
docker run --gpus all -p 8000:8000 -v $(pwd)/model_repository:/models \
    nvcr.io/nvidia/tritonserver:24.09-py3 tritonserver --model-repository=/models
```

Triton is frequently used **underneath** a higher-level framework (KServe can use
Triton as a backend runtime) rather than as a standalone choice — think of it as
the performance-optimized execution layer, with KServe/Seldon/BentoML providing
the Kubernetes-native deployment/traffic-management layer on top.

## Choosing a framework

| Need | Framework |
|---|---|
| Simple single model, moderate traffic, small team | Plain FastAPI + Deployment (no framework needed) |
| Standardized, Kubernetes-native serving with canary rollouts, scale-to-zero | **KServe** |
| Large language models specifically | **KServe with the vLLM runtime** |
| Multi-step inference graphs (pre/post-processing, ensembles) | **Seldon Core** (check current licensing) |
| Python-native developer experience, broad framework support | **BentoML** |
| Maximum raw throughput/latency on GPU, multi-framework | **Triton** (often as a backend under KServe) |

## Practical guidance

1. **Don't reach for a serving framework by default** — a plain FastAPI Deployment
   is genuinely the right choice for many, probably most, small-to-medium projects.
2. **For LLMs specifically, KServe + vLLM (or an equivalent purpose-built LLM
   serving runtime) is the right default**, not a hand-rolled generation loop.
3. **Reach for Seldon only for genuine multi-step inference graphs**, not single
   models — and check its current licensing terms first.
4. **BentoML trades some infrastructure control for developer experience** — a
   reasonable trade for teams prioritizing iteration speed over fine-grained
   Kubernetes control.
5. **Triton is usually the performance layer underneath a higher-level framework**,
   not typically the first thing you reach for standalone.