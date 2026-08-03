# Monitoring and Drift Detection — Prometheus, Grafana, Evidently

## Two distinct monitoring concerns for ML services

1. **Infrastructure/service health** — is the service up, fast, and not erroring?
   (The same concern as any web service.)
2. **Model quality over time** — is the model's *prediction quality* degrading,
   even if the service itself is perfectly healthy? (ML-specific — a model can be
   serving 200 OKs at low latency while quietly making worse and worse
   predictions as real-world data drifts from its training distribution.)

Both matter, and neither substitutes for the other — a green infrastructure
dashboard tells you nothing about whether the model is still accurate.

## Infrastructure monitoring — Prometheus + Grafana

**Prometheus** scrapes metrics from your services on an interval and stores them
as time series; **Grafana** visualizes them as dashboards and can fire alerts on
thresholds.

```python
# Expose metrics from a FastAPI ML service
from prometheus_client import Counter, Histogram, make_asgi_app

REQUEST_COUNT = Counter("inference_requests_total", "Total inference requests", ["status"])
REQUEST_LATENCY = Histogram("inference_latency_seconds", "Inference latency")

@app.post("/predict")
@REQUEST_LATENCY.time()
async def predict(input: PredictionInput):
    try:
        result = run_inference(input)
        REQUEST_COUNT.labels(status="success").inc()
        return result
    except Exception:
        REQUEST_COUNT.labels(status="error").inc()
        raise

app.mount("/metrics", make_asgi_app())   # Prometheus scrapes this endpoint
```

```yaml
# Kubernetes ServiceMonitor (if using the Prometheus Operator) — tells Prometheus
# to scrape this service's /metrics endpoint automatically
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: model-api-monitor
spec:
  selector:
    matchLabels:
      app: model-api
  endpoints:
    - port: metrics
      interval: 30s
```

### What to track for an ML service specifically

Beyond generic request count/latency/error rate:
- **Prediction latency distribution** (p50/p95/p99) — inference time specifically,
  separate from total request time, to isolate model-vs-infrastructure slowness.
- **Model version currently serving** (as a label on metrics) — critical for
  correlating any quality regression with a specific deploy.
- **Prediction distribution** (e.g., class balance for a classifier, or a
  rolling histogram of a regression output) — a sudden shift here, even without
  any infrastructure error, is often the first visible sign of data drift.
- **GPU utilization** (via `nvidia-smi`-based exporters like `dcgm-exporter`) for
  GPU-serving workloads, since CPU metrics alone don't reflect GPU-bound load.

## Model quality monitoring — data and prediction drift

**Data drift** — the statistical distribution of incoming production data diverges
from the training data distribution. **Prediction/concept drift** — the
relationship between inputs and the correct output changes over time (the world
changed, not just the data). Either can silently degrade a model that was
perfectly accurate at training time, with no infrastructure-level symptom at all.

```python
# Evidently AI — open-source drift detection
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset

report = Report(metrics=[DataDriftPreset()])
report.run(reference_data=training_data, current_data=recent_production_data)
report.save_html("drift_report.html")

drift_detected = report.as_dict()["metrics"][0]["result"]["dataset_drift"]
if drift_detected:
    alert_team("Data drift detected — investigate and consider retraining")
```

Run drift detection **on a schedule** (e.g., a daily/weekly Kubernetes CronJob)
comparing a rolling window of recent production inputs against the original
training distribution, rather than only reactively after someone notices degraded
outcomes downstream.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: drift-check
spec:
  schedule: "0 6 * * *"    # daily at 6am
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: drift-check
              image: myregistry.io/drift-checker:v1
          restartPolicy: OnFailure
```

## Logging — structured, correlatable logs

```python
import structlog

logger = structlog.get_logger()

@app.post("/predict")
async def predict(input: PredictionInput):
    logger.info("inference_request", model_version="v1.2.0", input_shape=input.shape)
    result = run_inference(input)
    logger.info("inference_complete", prediction=result, confidence=result.confidence)
    return result
```

Structured (JSON) logs, aggregated centrally (e.g., via a logging stack like
Loki, or your cloud provider's native log aggregation), let you correlate a
specific bad prediction back to the exact model version, input, and timestamp —
essential for debugging quality regressions after the fact, not just tailing
`kubectl logs` on whichever pod happened to serve a particular request.

## Alerting — connecting monitoring to action

```yaml
# Example Prometheus alerting rule
groups:
  - name: model-api-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(inference_requests_total{status="error"}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "Model API error rate above 5% for 5 minutes"
      - alert: HighLatency
        expr: histogram_quantile(0.95, inference_latency_seconds) > 2.0
        annotations:
          summary: "p95 inference latency above 2 seconds"
```

Alerts should route to wherever your team actually responds (Slack, PagerDuty,
etc.) — a dashboard nobody watches doesn't prevent an incident; an alert that
reaches a human does.

## Practical guidance

1. **Track infrastructure health and model quality as two distinct concerns** —
   healthy infrastructure metrics say nothing about prediction quality.
2. **Expose Prometheus metrics from every ML service**, including
   model-version-labeled prediction latency and a rolling prediction distribution,
   not just generic request/error counts.
3. **Run scheduled drift detection** (Evidently or equivalent) rather than relying
   on someone noticing degraded outcomes downstream — a daily/weekly CronJob is a
   low-effort, high-value addition.
4. **Use structured, centrally-aggregated logs** so a specific bad prediction can
   be traced back to its exact model version and input.
5. **Wire alerts to an actual notification channel**, not just a dashboard — the
   monitoring only prevents incidents if a human gets notified in time to act.