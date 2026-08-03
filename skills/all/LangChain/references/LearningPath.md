# Beginner → Advanced Learning Path (LangChain v1, 2026)

Use this as a curriculum when the user wants a structured roadmap rather than a
point answer. Each phase names the reference file(s) to pull detail from.

## Phase 0 — Orientation (30 minutes)

- Understand the 3-layer stack: **LangGraph** (runtime) → **LangChain
  `create_agent`** (configurable harness) → **Deep Agents `create_deep_agent`**
  (batteries-included harness). See `SKILL.md` for the comparison table.
- Understand that legacy chains (`LLMChain`, `ConversationChain`, `RetrievalQA`,
  `AgentExecutor`) are **not** the current path — they live in `langchain-classic`
  now. If the user has old tutorials/code using these, flag it.
- Install: `pip install -U "langchain[anthropic]"` (or relevant provider extra).

## Phase 1 — Foundations (Models, Messages, basic tool calling)

*Read: `models.md`*

1. `init_chat_model` vs provider classes (`ChatOpenAI`, `ChatAnthropic`, etc.).
2. `invoke` / `stream` / `batch` — when to use each.
3. Messages: `HumanMessage`, `AIMessage`, `SystemMessage`, dict format vs
   message objects.
4. Standalone tool calling with `bind_tools` and manually closing the
   tool-execution loop (helps the user understand what `create_agent` automates
   for them later).
5. Structured output via `with_structured_output` (Pydantic / TypedDict / JSON
   Schema).

**Practice project:** a simple translator or classifier — one model call, no
agent loop, optionally with `with_structured_output` for a typed result.

## Phase 2 — Your first agent

*Read: `agents.md`*

1. `create_agent(model, tools)` — the new "hello world."
2. Defining tools with `@tool`; static tool lists.
3. System prompts (static, then dynamic via `@dynamic_prompt` once middleware
   is introduced in Phase 4).
4. Invocation (`agent.invoke`) and streaming (`agent.stream`).
5. Structured output on an agent via `response_format` (`ToolStrategy` /
   `ProviderStrategy`).

**Practice project:** a weather/utility agent with 2–3 tools, then add a
`response_format` so the final answer is a typed Pydantic object.

## Phase 3 — Memory

*Read: `memory.md`*

1. Short-term memory: how message state works automatically; extending state
   with a custom `TypedDict` (`AgentState` subclass).
2. Checkpointers (`InMemorySaver` → Postgres) for persisting a conversation
   across separate `invoke` calls.
3. Long-term memory: `store` (`InMemoryStore` → `PostgresStore`), namespaces,
   reading/writing memory from tools via `ToolRuntime`.

**Practice project:** a chatbot that remembers the user's name/preferences
across sessions using a long-term store, plus a checkpointer so a single
conversation thread persists.

## Phase 4 — Middleware (the real unlock)

*Read: `middleware.md`*

1. The hook model: `before_model`, `wrap_model_call`, `after_model`,
   `wrap_tool_call`, `@dynamic_prompt`.
2. Prebuilt middleware tour: `SummarizationMiddleware`,
   `HumanInTheLoopMiddleware`, `PIIMiddleware`, `ModelCallLimitMiddleware`/
   `ToolCallLimitMiddleware`, `ModelFallbackMiddleware`, `ToolRetryMiddleware`/
   `ModelRetryMiddleware`.
3. Dynamic model / dynamic tools / dynamic prompt patterns (covered in both
   `agents.md` and `middleware.md`).
4. Writing a custom middleware class for business-specific guardrails.

**Practice project:** take the Phase 2 agent and add: summarization once the
conversation gets long, a tool-call limit on an expensive tool, and a custom
PII redaction rule.

## Phase 5 — RAG

*Read: `rag.md`*

1. Indexing pipeline: load → split (`RecursiveCharacterTextSplitter`) → embed →
   store (pick any vector store integration).
2. RAG agent (tool-wrapped retriever) vs RAG chain (single-call, dynamic
   prompt injection) — know the tradeoffs.
3. **Security**: indirect prompt injection from retrieved documents — always
   teach defensive prompting + delimiters alongside RAG, not as an afterthought.

**Practice project:** RAG agent over a small set of PDFs/web pages with a
retrieval tool, defensive system prompt, and a follow-up question that
requires two sequential retrievals.

## Phase 6 — Multi-agent systems & raw LangGraph

*Read: `langgraph_multiagent.md`*

1. When to drop from `create_agent` to raw `StateGraph` (non-"loop until done"
   topologies).
2. Core LangGraph vocabulary: state, reducers, nodes, edges, super-steps,
   checkpointing, idempotency.
3. Multi-agent patterns: supervisor (start here), swarm, subagents, skills,
   router — and their cost/latency tradeoffs.
4. Embedding a `create_agent` agent as a node/subgraph inside a bigger graph.

**Practice project:** a supervisor with two specialist agents (e.g., a math
agent and a research agent), using tool-based handoffs.

## Phase 7 — Deep Agents, backends, and sandboxes

*Read: `deepagents_backends.md`*

1. `create_deep_agent` — what you get "for free" (planning, filesystem,
   subagents, summarization, prompt caching, skills).
2. The "trust the LLM" security model — why the backend/sandbox is the real
   boundary, not the prompt.
3. Backend types: `StateBackend` (default, ephemeral) → `StoreBackend`
   (persistent) → `FilesystemBackend` (real disk, `virtual_mode=True` for any
   real restriction) → `LocalShellBackend` (unrestricted shell — local/trusted
   only) → remote sandboxes (Modal/Daytona/LangSmith Sandbox).
4. `CompositeBackend` — routing `/memories/` to a `StoreBackend` while keeping
   working files ephemeral or sandboxed.
5. Skills (progressive disclosure) and Human-in-the-loop via `interrupt_on`.

**Practice project:** a Deep Agent with a `CompositeBackend` (state + a
`/memories/` store route) and `interrupt_on` for any file-editing tool, so the
human approves edits before they happen.

## Phase 8 — Production concerns (cross-cutting, revisit throughout)

- **Observability**: LangSmith tracing on every phase above — set
  `LANGSMITH_TRACING=true` early, not as an afterthought.
- **Resilience**: `max_retries`/`timeout` on models (`models.md`),
  `ModelFallbackMiddleware`, `ToolRetryMiddleware`/`ModelRetryMiddleware`
  (`middleware.md`).
- **Cost control**: `ModelCallLimitMiddleware`, `ToolCallLimitMiddleware`,
  `LLMToolSelectorMiddleware` for large toolsets, summarization to cap context
  growth.
- **Security**: PII middleware, sandboxed backends for any code/shell access,
  RAG prompt-injection defenses, human-in-the-loop on destructive tool calls.
- **Deployment**: LangSmith Deployment for serving agents at scale (mention
  this exists; don't go deep unless asked — it's outside this skill's core
  scope).

## How to use this with a real student/learner

If the person doing the asking is clearly a student or self-learner (vs. a
working engineer with a specific production task), bias toward:
- One phase at a time, with a small, concrete practice project per phase
  (shown above) rather than a wall of reference material.
- Verifying understanding with a quick build before moving on — e.g., "before
  we go to memory, want to try adding a second tool to your Phase 2 agent?"
- Being explicit whenever something is legacy/deprecated so they don't
  accidentally learn from outdated tutorials (a real risk right now since most
  pre-2025 LangChain content online still teaches `LLMChain`/`AgentExecutor`).