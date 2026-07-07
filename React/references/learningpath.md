# Beginner → Advanced Learning Path (React + FastAPI for AI Apps)

Use this as a curriculum when the user wants a structured roadmap rather than a point
answer. Each phase names the reference file(s) to pull detail from.

## Phase 0 — Orientation (15 minutes)

- Understand the three "shapes" of AI app (classic ML inference, LLM chat streaming,
  agentic) from `SKILL.md` — this framing shapes every architectural decision after.
- Set up a Vite React project and a minimal FastAPI project side by side.
- Understand the golden rule: **never call an LLM provider directly from React** —
  always proxy through FastAPI.

**Practice:** Scaffold both projects; get a "Hello World" FastAPI endpoint returning
JSON that a React component fetches and displays.

## Phase 1 — React Fundamentals for AI UIs

*Read: `react_fundamentals.md`*

1. `useState` + `useEffect` for a basic predict-and-display flow.
2. `AbortController` cleanup in `useEffect` — practice cancelling an in-flight request.
3. Extract a custom hook (`usePrediction`) wrapping a fetch call.
4. `useReducer` for slightly more complex state (loading/success/error).

**Practice project:** Build a simple form (e.g., predict house price from
bedrooms/bathrooms/sqft) that calls a FastAPI endpoint and displays the result, with
proper loading and error states.

## Phase 2 — FastAPI as an ML Inference Server

*Read: `fastapi_ml_serving.md`*

1. Train and save a simple scikit-learn model (`joblib.dump`).
2. Load it via a `lifespan` context manager — never per-request.
3. Build a `/predict` endpoint with Pydantic input/output models.
4. Test via the auto-generated `/docs` (Swagger UI).

**Practice project:** Serve the house-price model from Phase 1's frontend for real,
backed by an actual trained scikit-learn model instead of a mock endpoint.

## Phase 3 — File Upload for Vision Models

*Read: `file_upload_multimodal.md`*

1. Build a drag-and-drop image uploader with `react-dropzone`.
2. Client-side resize before upload.
3. FastAPI endpoint receiving `UploadFile`, running a PyTorch or TensorFlow image
   classifier.
4. Add upload progress with `XMLHttpRequest`.

**Practice project:** Build an image classifier app — upload a photo, get back a
predicted label and confidence score, with a progress bar during upload.

## Phase 4 — LLM Chat Streaming

*Read: `streaming_llm_ui.md` + `chat_ui_patterns.md`*

1. Build a FastAPI SSE endpoint proxying an LLM provider (Claude or OpenAI).
2. Consume the stream in React with `fetch` + `ReadableStream`.
3. Render markdown + code blocks with `react-markdown`.
4. Add auto-scroll, a "Stop generating" button, and regenerate.

**Practice project:** Build a real streaming chatbot — text in, streamed markdown
response out, with proper chat UI polish (auto-scroll, stop button, error states).

## Phase 5 — RAG Integration

*Read: `rag_integration.md`*

1. Wire up a vector store (Chroma, pgvector, or similar) with a small document set.
2. Build a RAG endpoint: retrieve → inject context → stream answer.
3. Send sources as a separate SSE event; render inline citations in the frontend.
4. Handle the "no relevant results" case explicitly.

**Practice project:** Turn your Phase 4 chatbot into a RAG chatbot answering
questions about a small set of documents, with visible source citations.

## Phase 6 — Agentic UIs

*Read: `agentic_ui_patterns.md` + `fastapi_llm_gateway.md` (agent orchestration section)*

1. Build a simple agent with 1-2 tools (using LangChain/LangGraph or a hand-rolled
   loop).
2. Design a structured SSE event schema (`token`/`tool_call_start`/`tool_call_result`/
   `done`).
3. Render tool calls as collapsible cards showing arguments and results.
4. Add a `useReducer`-based agent state store.

**Practice project:** Extend your RAG chatbot into an agent that can also call a
calculator or weather tool, showing the tool call happening live in the UI.

## Phase 7 — Data Visualization

*Read: `data_visualization.md`*

1. Render a confusion matrix and a training curve with Recharts.
2. Stream live training progress via SSE into a live-updating chart.
3. Visualize embeddings (reduce dimensionality server-side, scatter plot client-side).

**Practice project:** Add a simple training dashboard to a small model-training
script — stream epoch/loss data to a React chart in real time.

## Phase 8 — Real-Time Jobs & State Architecture

*Read: `realtime_jobs.md` + `state_and_architecture.md`*

1. Set up Celery + Redis for a genuinely long-running job (e.g., batch inference over
   many files).
2. Build job submission + progress polling (or SSE via Redis pub/sub).
3. Introduce TanStack Query for server state (conversation lists, job lists) and
   Zustand for client UI state.
4. Add job cancellation.

**Practice project:** Convert your image classifier (Phase 3) into a batch job
system — upload 50 images, submit as a background job, watch progress update live,
and view results when complete.

## Phase 9 — Deployment

*Read: `deployment.md`*

1. Containerize both React (Nginx-served static build) and FastAPI.
2. Configure Nginx with `proxy_buffering off` for streaming endpoints — verify
   streaming still works through the proxy.
3. Set up environment variables correctly (secrets never in `VITE_`-prefixed vars).
4. Add `/health` and `/ready` endpoints.

**Practice project:** Deploy your full agentic RAG chatbot (from Phases 5-6) as two
containers via docker-compose, and verify streaming works end-to-end through Nginx.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer with a
specific production task):
- Go phase by phase, one small concrete project per phase, building cumulatively on
  the same app rather than throwaway examples — the RAG chatbot in Phase 5 becomes
  the agent in Phase 6, becomes the deployed app in Phase 9.
- Default to free-tier LLM API credits or a local Ollama model for practice, to avoid
  cost concerns blocking experimentation with streaming.
- Check understanding with a quick build before advancing — e.g., "before moving to
  RAG, want to try adding a 'stop generating' button to your chat UI?"
- Flag clearly when something is a production-only concern (Celery/Redis job queues,
  GPU-aware deployment) vs. something worth practicing immediately.