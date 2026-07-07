---
name: react-ai-architect
description: >
  Architect's manual for building AI-native web apps with a React frontend and
  FastAPI backend — covering ML, deep learning, and agentic application development.
  Use when the user asks about building an AI app, ML app, chatbot, agent UI, RAG
  interface, or AI-powered website with React and/or FastAPI. Covers: streaming LLM
  responses (SSE, WebSockets) into a chat UI, agentic UIs (tool-call visualization,
  human-in-the-loop approval), file/image upload for vision and multimodal models,
  FastAPI as an ML/DL inference server (scikit-learn, PyTorch, TensorFlow), FastAPI as
  an LLM gateway, data visualization for ML dashboards, React plus vector database/RAG
  integration, real-time training progress, and production deployment. Trigger for
  "build a chatbot UI", "stream LLM responses in React", "build an image classifier
  web app", "create an agent dashboard", "FastAPI + React ML app", or any AI/ML/agentic
  product spanning React and FastAPI.
---

# The React + FastAPI AI Application Architect's Manual

You are acting as an expert full-stack engineer specializing in **AI-native
applications**: products where the core value is a machine learning model, deep
learning model, or LLM agent, wrapped in a React frontend and served by a FastAPI
backend. This skill is scoped specifically to that intersection — not generic React
or generic FastAPI, but the patterns unique to building ML/DL/agentic products.

## The mental model: three kinds of "AI app"

Every AI-facing app you'll build falls into one (or a combination) of three shapes,
each with a different frontend/backend contract:

| Shape | What it is | Frontend pattern | Backend pattern |
|---|---|---|---|
| **Classic ML/DL inference** | Structured input → a prediction (classification, regression, image label, embedding) | A form or file upload → a single request → a result card/chart | FastAPI loads a trained model once at startup, exposes a `/predict` endpoint |
| **LLM chat / streaming generation** | Conversational or generative text, appearing token-by-token | A chat UI that renders incrementally as tokens arrive | FastAPI streams via SSE or a raw generator, proxying an LLM provider or local model |
| **Agentic application** | Multi-step reasoning, tool calls, potentially long-running, may need human approval | A UI showing live "thinking"/tool-call steps, not just a final answer | FastAPI orchestrates an agent loop (LangChain/LangGraph/custom) and streams structured events, not just text |

Most real products combine these — e.g., a RAG chatbot is "LLM chat" + "classic
inference" (the retrieval step) + often "agentic" (deciding when to retrieve).

## Quick-start stack

```
React (Vite) ── fetch/EventSource/WebSocket ── FastAPI ── model / LLM / agent
                                                    │
                                            (loaded once at startup,
                                             or a provider API call)
```

```bash
# Frontend
npm create vite@latest my-ai-app -- --template react-ts
cd my-ai-app && npm install

# Backend
pip install "fastapi[standard]" uvicorn python-multipart
```

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| React fundamentals refresher through an AI-app lens: hooks, state, effects, data fetching patterns | `references/react_fundamentals.md` |
| Streaming LLM responses into React: SSE, WebSockets, fetch streaming, `EventSource` vs `fetch` | `references/streaming_llm_ui.md` |
| Building chat interfaces: message lists, markdown/code rendering, auto-scroll, regenerate/stop | `references/chat_ui_patterns.md` |
| Agentic UIs: tool-call visualization, multi-step "thinking" traces, human-in-the-loop approval, multi-agent dashboards | `references/agentic_ui_patterns.md` |
| FastAPI as an ML/DL inference server: loading scikit-learn/PyTorch/TensorFlow models, `/predict` endpoints, batching, background tasks | `references/fastapi_ml_serving.md` |
| FastAPI as an LLM gateway: proxying OpenAI/Anthropic/local models, SSE endpoints, agent orchestration endpoints | `references/fastapi_llm_gateway.md` |
| File/image/audio upload for vision & multimodal models: drag-and-drop, preview, progress, validation | `references/file_upload_multimodal.md` |
| Data visualization for ML/analytics: charts, confusion matrices, embeddings/vector visualization, live training curves | `references/data_visualization.md` |
| RAG and vector DB integration from the frontend: search UIs, source citations, hybrid search filters | `references/rag_integration.md` |
| Real-time progress: WebSockets for training/inference jobs, job queues, polling vs push | `references/realtime_jobs.md` |
| State management and architecture for AI apps: when to use Context vs Zustand/Redux, API layer design | `references/state_and_architecture.md` |
| Deployment: containerizing React + FastAPI, environment config, CORS, GPU-aware deployment | `references/deployment.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Never call an LLM provider or expose API keys directly from React.** Always
   proxy through FastAPI — this is non-negotiable for both security (API keys
   decompiled from client bundles) and control (rate limiting, cost tracking, model
   swapping without a frontend redeploy).
2. **Stream by default for anything LLM-generated.** A 5-15 second wait with no
   feedback is a broken UX; token-by-token streaming (SSE or WebSockets) is the
   baseline expectation set by ChatGPT/Claude, not a nice-to-have.
3. **Load models once at FastAPI startup** (via a `lifespan` context manager), never
   per-request — re-loading a model on every request is a common beginner mistake
   that tanks latency and can cause race conditions.
4. **Prefer SSE over WebSockets unless you specifically need bidirectional
   communication or mid-stream cancellation that must stop server-side generation
   immediately.** SSE is simpler, works over plain HTTP/1.1, and is easier to proxy
   and load-balance. Reach for WebSockets for enterprise-grade chat needing instant
   cancellation, or genuinely bidirectional agent interaction.
5. **Design agentic UIs around events, not just text.** An agent's useful UI state
   includes tool calls, intermediate reasoning, and step transitions — structure your
   backend to emit typed events (`{"type": "tool_call", ...}`, `{"type": "token",
   ...}`) rather than a flat token stream, so the frontend can render more than a
   wall of text.
6. **Validate and constrain file uploads client-side and server-side** — size limits,
   MIME type checks, and (for vision models) client-side image resizing before upload
   to reduce latency and cost.
7. **Separate the "ML/DL inference" concern from the "web API" concern in FastAPI** —
   keep model loading, preprocessing, and inference logic in a dedicated module, not
   inline in route handlers, so it's testable independent of HTTP.
8. **Source of truth:** `react.dev` and `fastapi.tiangolo.com`. Both ship fast (React
   19+ features, FastAPI's native SSE support added in 0.135.0) — web-search for
   anything version-specific rather than assuming older patterns still apply.