# Real-Time Progress for Training/Inference Jobs

## Why this is a distinct pattern from LLM chat streaming

LLM chat streaming (see `streaming_llm_ui.md`) is a single request-response cycle
lasting seconds. **Training jobs, batch inference, and fine-tuning runs** are
different: they can run for minutes to hours, must survive the browser tab closing,
need to be resumable, and should report structured progress (epoch, batch, metrics)
rather than tokens.

## Architecture: submit a job, then observe its progress separately

```
React: POST /api/jobs → { job_id } → React: subscribe to progress via SSE/WebSocket/polling
                                              ↑
FastAPI: background worker (Celery/RQ/asyncio task) updates job status in Redis/DB
```

The key architectural difference from chat streaming: **the job must be decoupled
from the HTTP request that created it.** A training job shouldn't run inside the
request handler — if the client disconnects (closes the tab, loses wifi), the job
should keep running.

## Backend: submitting a job

```python
from fastapi import FastAPI, BackgroundTasks
import uuid
import redis

app = FastAPI()
r = redis.Redis()

@app.post("/api/jobs/train")
async def start_training_job(config: TrainingConfig, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    r.hset(f"job:{job_id}", mapping={"status": "queued", "progress": 0})
    background_tasks.add_task(run_training_job, job_id, config)
    return {"job_id": job_id}
```

**For genuinely long jobs (minutes to hours), use a real task queue (Celery, RQ, or
Dramatiq)**, not `BackgroundTasks` — `BackgroundTasks` runs in the same process as
your API server and won't survive a server restart or scale independently from your
API. `BackgroundTasks` is fine for short-lived work (seconds); use a proper queue for
anything longer.

```python
# tasks.py — using Celery for a real, durable job queue
from celery import Celery

celery_app = Celery("tasks", broker="redis://localhost:6379/0")

@celery_app.task(bind=True)
def train_model_task(self, config: dict):
    for epoch in range(config["epochs"]):
        metrics = train_one_epoch(config)
        self.update_state(state="PROGRESS", meta={"epoch": epoch, "metrics": metrics})
    return {"status": "complete"}
```

```python
@app.post("/api/jobs/train")
async def start_training_job(config: TrainingConfig):
    task = train_model_task.delay(config.model_dump())
    return {"job_id": task.id}
```

## Reporting progress: SSE stream backed by Redis pub/sub

```python
@app.get("/api/jobs/{job_id}/stream")
async def stream_job_progress(job_id: str):
    async def generate():
        pubsub = r.pubsub()
        pubsub.subscribe(f"job_updates:{job_id}")
        while True:
            message = pubsub.get_message(timeout=30)
            if message and message["type"] == "message":
                data = json.loads(message["data"])
                yield f"data: {json.dumps(data)}\n\n"
                if data.get("status") in ("complete", "failed"):
                    break
            await asyncio.sleep(0.1)
    return StreamingResponse(generate(), media_type="text/event-stream")
```

```python
# Worker publishes updates as it progresses
def train_one_epoch(config, job_id):
    metrics = { ... }
    r.publish(f"job_updates:{job_id}", json.dumps({"epoch": epoch, "metrics": metrics, "status": "running"}))
```

Redis pub/sub decouples the worker process (Celery) from the API process — the
worker doesn't need to know anything about HTTP/SSE, it just publishes progress
messages, and any API instance can relay them to a connected client.

## Frontend: subscribing to job progress

```jsx
function useJobProgress(jobId) {
  const [progress, setProgress] = useState({ status: "queued", history: [] });

  useEffect(() => {
    if (!jobId) return;
    const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress((prev) => ({
        status: data.status,
        history: [...prev.history, data],
      }));
      if (data.status === "complete" || data.status === "failed") {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      // Fall back to polling if SSE connection fails
    };

    return () => eventSource.close();
  }, [jobId]);

  return progress;
}
```

```jsx
function TrainingJobMonitor({ jobId }) {
  const { status, history } = useJobProgress(jobId);
  return (
    <div>
      <JobStatusBadge status={status} />
      <TrainingCurve history={history.map((h) => h.metrics)} />
    </div>
  );
}
```

## Polling as a fallback (or default, for simplicity)

For less latency-sensitive dashboards, or when SSE/WebSocket infrastructure is
overkill, simple polling is a legitimate, much simpler choice:

```jsx
function useJobStatus(jobId, intervalMs = 3000) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!jobId) return;
    let active = true;

    const poll = async () => {
      const response = await fetch(`/api/jobs/${jobId}`);
      const data = await response.json();
      if (active) setStatus(data);
      if (active && data.status !== "complete" && data.status !== "failed") {
        setTimeout(poll, intervalMs);
      }
    };
    poll();

    return () => { active = false; };
  }, [jobId, intervalMs]);

  return status;
}
```

```python
@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    data = r.hgetall(f"job:{job_id}")
    if not data:
        raise HTTPException(404, "Job not found")
    return {"status": data[b"status"].decode(), "progress": float(data[b"progress"])}
```

**Polling vs. push, the practical trade-off:** push (SSE/WebSocket) gives lower
latency and less wasted traffic; polling is simpler to implement and debug, works
trivially through any proxy/load balancer, and is often "good enough" for anything
where a few seconds of update latency doesn't matter (e.g., a training dashboard
someone glances at occasionally, vs. a live token stream someone is actively reading).

## Job cancellation

```python
@app.post("/api/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    celery_app.control.revoke(job_id, terminate=True)
    r.hset(f"job:{job_id}", "status", "cancelled")
    return {"status": "cancelled"}
```

```jsx
function CancelJobButton({ jobId }) {
  const handleCancel = async () => {
    await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
  };
  return <button onClick={handleCancel}>Cancel Job</button>;
}
```

## Persisting job history across page reloads

Since the job runs independently of any specific browser tab, store job IDs
somewhere the user can return to them:

```jsx
useEffect(() => {
  const activeJobs = JSON.parse(localStorage.getItem("activeJobs") || "[]");
  setActiveJobIds(activeJobs);
}, []);

const startJob = async (config) => {
  const { job_id } = await submitJob(config);
  const updated = [...activeJobIds, job_id];
  localStorage.setItem("activeJobs", JSON.stringify(updated));
  setActiveJobIds(updated);
};
```

For a multi-device or multi-session experience, store active job IDs against the
user's account server-side instead of `localStorage` — `localStorage` only works for
returning to the same browser.

## Practical guidance

1. **Decouple long-running jobs from the HTTP request that starts them** — use a real
   task queue (Celery/RQ/Dramatiq) for anything beyond a few seconds, not
   `BackgroundTasks`.
2. **Use Redis pub/sub (or similar) to bridge worker progress to API-layer SSE** —
   the worker shouldn't need to know about HTTP at all.
3. **Default to polling for simplicity** unless you have a specific need for
   push-based low latency — it's genuinely fine for many dashboard use cases.
4. **Always implement job cancellation** — long-running jobs (especially anything
   costing GPU time or API credits) need an explicit stop mechanism.
5. **Persist job IDs somewhere durable** (localStorage for single-device, backend/DB
   for multi-device) so users can return to an in-progress job after navigating away
   or reloading.