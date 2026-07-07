# FastAPI as an ML/DL Inference Server

## The core pattern: load once, predict many times

The single most common mistake in ML-serving FastAPI apps: reloading the model on
every request. Models should load **once, at startup**, and stay in memory for the
life of the process.

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import joblib

ml_models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_models["classifier"] = joblib.load("artifacts/model.joblib")
    yield
    ml_models.clear()  # cleanup on shutdown

app = FastAPI(lifespan=lifespan)
```

The `lifespan` context manager is the modern FastAPI pattern (replacing the older
`@app.on_event("startup")` decorator) — code before `yield` runs at startup, code
after runs at shutdown.

## Serving a scikit-learn model

```python
from pydantic import BaseModel, Field

class PredictionInput(BaseModel):
    sepal_length: float = Field(..., gt=0)
    sepal_width: float = Field(..., gt=0)
    petal_length: float = Field(..., gt=0)
    petal_width: float = Field(..., gt=0)

class PredictionOutput(BaseModel):
    predicted_class: str
    probabilities: dict[str, float]

@app.post("/api/predict", response_model=PredictionOutput)
async def predict(input: PredictionInput):
    model = ml_models["classifier"]
    features = [[input.sepal_length, input.sepal_width, input.petal_length, input.petal_width]]
    prediction = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    return PredictionOutput(
        predicted_class=str(prediction),
        probabilities={cls: float(p) for cls, p in zip(model.classes_, probabilities)},
    )
```

Pydantic input/output models give you **automatic validation** (reject malformed
requests before they hit your model) and **automatic OpenAPI docs** (`/docs`) — a
huge advantage over Flask for ML serving, since your frontend team gets a live,
interactive API spec for free.

## Serving a PyTorch model

```python
import torch
from PIL import Image
import io

@asynccontextmanager
async def lifespan(app: FastAPI):
    model = torch.load("artifacts/model.pt", map_location="cpu")
    model.eval()
    ml_models["vision_model"] = model
    yield
    ml_models.clear()

app = FastAPI(lifespan=lifespan)

@app.post("/api/classify-image")
async def classify_image(file: UploadFile):
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = preprocess(image).unsqueeze(0)  # your preprocessing pipeline

    with torch.no_grad():   # critical: disables gradient tracking for inference
        output = ml_models["vision_model"](tensor)
        probabilities = torch.softmax(output, dim=1)[0]

    top_prob, top_class = torch.max(probabilities, dim=0)
    return {"class": CLASS_NAMES[top_class.item()], "confidence": top_prob.item()}
```

**Always wrap inference in `torch.no_grad()`** — it disables gradient computation,
substantially reducing memory use and speeding up inference, since gradients are only
needed during training.

## Serving a TensorFlow/Keras model

```python
import tensorflow as tf
import numpy as np

@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_models["model"] = tf.keras.models.load_model("artifacts/model.keras")
    yield

@app.post("/api/predict-image")
async def predict_image(file: UploadFile):
    image = Image.open(io.BytesIO(await file.read())).convert("RGB").resize((224, 224))
    array = np.expand_dims(np.array(image) / 255.0, axis=0)
    predictions = ml_models["model"].predict(array)
    return {"predicted_class": int(np.argmax(predictions[0])), "confidence": float(np.max(predictions[0]))}
```

## Project structure — separating model logic from HTTP logic

```
app/
├── main.py              # FastAPI app, route definitions only
├── models/
│   └── inference.py     # model loading, preprocessing, prediction logic
├── schemas/
│   └── prediction.py    # Pydantic request/response models
└── artifacts/
    └── model.joblib
```

```python
# models/inference.py — pure Python, testable without any HTTP framework
def preprocess(raw_input: dict) -> list[float]:
    return [raw_input["sepal_length"], raw_input["sepal_width"], ...]

def predict(model, features: list[float]) -> dict:
    prediction = model.predict([features])[0]
    return {"class": str(prediction)}
```

```python
# main.py — thin route handlers delegating to models/inference.py
from models.inference import preprocess, predict

@app.post("/api/predict")
async def predict_endpoint(input: PredictionInput):
    features = preprocess(input.model_dump())
    return predict(ml_models["classifier"], features)
```

Keeping inference logic separate from route handlers lets you unit-test model
behavior directly, without spinning up a test HTTP client — and makes it trivial to
reuse the same inference code from a CLI script, a batch job, or a notebook.

## Batching requests for throughput

For high-traffic endpoints, batch multiple incoming requests into a single model
call rather than running inference one request at a time:

```python
import asyncio

class BatchPredictor:
    def __init__(self, model, max_batch_size=32, max_wait_ms=50):
        self.model = model
        self.queue = asyncio.Queue()
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        asyncio.create_task(self._batch_loop())

    async def predict(self, features):
        future = asyncio.get_event_loop().create_future()
        await self.queue.put((features, future))
        return await future

    async def _batch_loop(self):
        while True:
            batch = [await self.queue.get()]
            try:
                while len(batch) < self.max_batch_size:
                    item = await asyncio.wait_for(self.queue.get(), timeout=self.max_wait_ms / 1000)
                    batch.append(item)
            except asyncio.TimeoutError:
                pass
            features_batch = [f for f, _ in batch]
            results = self.model.predict(features_batch)
            for (_, future), result in zip(batch, results):
                future.set_result(result)
```

Only worth the added complexity once you have genuine concurrent traffic — for
low-to-moderate traffic, per-request inference (as in the basic examples above) is
simpler and sufficient.

## GPU-bound models: avoid blocking the event loop

FastAPI's async event loop is single-threaded for Python code — a long, synchronous
GPU inference call **blocks all other requests** unless offloaded to a worker thread
or process:

```python
from fastapi.concurrency import run_in_threadpool

@app.post("/api/predict")
async def predict(input: PredictionInput):
    result = await run_in_threadpool(run_inference, ml_models["model"], input)
    return result
```

For genuinely heavy models, consider running inference in a **separate process** (via
`ProcessPoolExecutor`, or a dedicated inference server like TorchServe/Triton) rather
than in-process with the API — this also avoids GIL contention and lets you scale the
inference workers independently of the API layer.

## Background tasks for non-blocking side effects

```python
from fastapi import BackgroundTasks

@app.post("/api/predict")
async def predict(input: PredictionInput, background_tasks: BackgroundTasks):
    result = run_inference(input)
    background_tasks.add_task(log_prediction, input, result)  # runs after response is sent
    return result
```

Use `BackgroundTasks` for cheap, fire-and-forget work (logging, sending a webhook) —
not for genuinely long-running jobs, which need a real task queue (Celery, RQ, or an
async job system) so they survive process restarts and can report progress (see
`realtime_jobs.md`).

## Practical guidance

1. **Always load models in `lifespan`, never per-request.**
2. **Use Pydantic models for request/response** — free validation and OpenAPI docs.
3. **Separate inference logic (`models/`) from route handlers (`main.py`)** for
   testability.
4. **Wrap PyTorch inference in `torch.no_grad()`.**
5. **Offload genuinely heavy/GPU-bound inference to a threadpool or separate
   process** — don't let it block the async event loop.
6. **Batch requests only once you have real concurrent traffic** justifying the
   added complexity.