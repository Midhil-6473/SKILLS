---
name: langchain-architect
description: Comprehensive, up-to-date (LangChain v1 / 2026) architect's manual for building LLM applications and agents with LangChain, LangGraph, and Deep Agents. Use this skill whenever the user asks about LangChain — building agents, chatbots, RAG pipelines, choosing or configuring models, adding memory (short-term or long-term), writing or using middleware, setting up filesystem/sandbox backends, building multi-agent systems, structured output, streaming, tool calling, human-in-the-loop, or learning LangChain from beginner to advanced level. Also use when the user wants a LangChain learning path/roadmap, code examples, or wants to know "how to add X" (models, memory, middleware, backend, deepagents, sandbox) in LangChain. Trigger even if the user uses older terminology like LLMChain, ConversationChain, or AgentExecutor — redirect them to the current v1 equivalents.
---

# The LangChain Architect's Manual (v1, 2026)

You are acting as an expert LangChain architect. LangChain went through a major
architectural shift with **v1.0**: legacy chains (`LLMChain`, `ConversationChain`,
`RetrievalQA`, `AgentExecutor`) have moved to `langchain-classic` and are no longer
the recommended path. The current paradigm is:

> **Agent = Model + Harness**, where the harness (`create_agent`) is a thin,
> middleware-extensible wrapper around a **LangGraph** graph.

Do not teach or default to legacy chain patterns unless the user explicitly asks
about legacy/`langchain-classic` code for migration purposes.

## The three-layer mental model

Always orient the user (and yourself) using this stack before diving into code:

| Layer | What it is | When to reach for it |
|---|---|---|
| **LangGraph** | Low-level graph orchestration runtime (nodes, edges, state, checkpointing). Everything below is built on it. | Custom control flow, deterministic + agentic hybrid workflows, complex multi-agent topologies, heavy customization. |
| **LangChain (`create_agent`)** | A production-ready, highly configurable single-agent harness built as a LangGraph graph. Middleware is its main extension point. | The default starting point for most agents — chatbots, RAG agents, tool-using agents, custom business logic. |
| **Deep Agents (`create_deep_agent`)** | An opinionated, "batteries-included" harness built on top of `create_agent`. Ships with planning (to-do lists), a virtual filesystem, subagents, automatic context summarization, and prompt caching by default. | Long-running coding/research agents, anything that benefits from Claude-Code-like capabilities with minimal setup. |

**Rule of thumb to give the user:** start with Deep Agents if they want maximum
capability with minimal setup; use `create_agent` directly when they need
fine-grained control; drop to raw LangGraph only when the topology genuinely
isn't "loop until done" (e.g., classify-then-route, fan-out/fan-in, deterministic
pipelines interleaved with agentic steps).

## Quick install

```bash
pip install -U "langchain[anthropic]"   # or [openai], [google-genai], etc.
pip install -U deepagents               # only if using Deep Agents
```

```python
from langchain.chat_models import init_chat_model
from langchain.agents import create_agent
from langchain.tools import tool
from langchain.messages import HumanMessage, AIMessage, SystemMessage
```

## Minimal working agent (the new "hello world")

```python
from langchain.agents import create_agent
from langchain.tools import tool

@tool
def get_weather(location: str) -> str:
    """Get the weather for a location."""
    return f"It's sunny in {location}."

agent = create_agent("claude-sonnet-4-6", tools=[get_weather])

result = agent.invoke({
    "messages": [{"role": "user", "content": "What's the weather in Hyderabad?"}]
})
print(result["messages"][-1].text)
```

This single call already gets you: a ReAct tool-calling loop, LangGraph durable
execution, streaming support, and an extensible middleware stack — none of which
required `AgentExecutor`, `LLMChain`, or manual prompt templates.

---

## How to use this skill (routing map)

This SKILL.md stays intentionally short. Read the relevant reference file(s)
below based on what the user is asking about — don't try to hold the whole
framework in context at once.

| User is asking about... | Read this file |
|---|---|
| Models — providers, `init_chat_model`, static/dynamic model selection, structured output, multimodal, reasoning, tool calling basics, rate limiting, prompt caching, token usage | `references/models.md` |
| Agents — `create_agent` deep dive, tools (static/dynamic), system prompts, invocation, streaming, structured output strategies | `references/agents.md` |
| Memory — short-term (state) vs long-term (store), `AgentState`, checkpointers, `InMemoryStore`/Postgres, reading/writing memory in tools | `references/memory.md` |
| Middleware — the agent loop hooks, all prebuilt middleware (summarization, HITL, PII, retries, fallback, filesystem, subagents, shell, etc.), writing custom middleware | `references/middleware.md` |
| Deep Agents, backends, and sandboxes — `create_deep_agent`, `StateBackend`/`FilesystemBackend`/`StoreBackend`/`CompositeBackend`, sandboxed shell execution, skills, subagents, persistent memory via `/memories/` | `references/deepagents_backends.md` |
| RAG / retrieval | `references/rag.md` |
| Multi-agent systems, LangGraph fundamentals (graphs, state, edges) | `references/langgraph_multiagent.md` |
| A structured beginner→advanced learning path / curriculum | `references/learning_path.md` |

Read **only** the file(s) relevant to the current question. For a broad "teach me
everything" request, read them in the order listed above and present a structured
walkthrough rather than dumping all files verbatim — synthesize.

## Core best practices (apply regardless of which file you read)

1. **Default to `create_agent`, not legacy chains.** If the user's existing code uses
   `LLMChain`, `ConversationChain`, `RetrievalQA`, or `AgentExecutor`, treat it as
   legacy and offer the v1 equivalent rather than extending it.
2. **Reach for middleware before reaching for custom LangGraph nodes**, when working
   with `create_agent`. Middleware (`@wrap_model_call`, `@before_model`,
   `@after_model`, `@wrap_tool_call`) covers the vast majority of customization needs
   (dynamic models/tools/prompts, guardrails, retries, summarization) without
   dropping to raw graph construction.
2. **Model identifier strings are provider-prefixed**: `"provider:model"`
   (e.g., `"anthropic:claude-sonnet-4-6"`); many are auto-inferred without the
   prefix (e.g., `"claude-sonnet-4-6"`, `"gpt-5.5"`).
3. **Memory is two distinct things** — short-term (conversation/thread-scoped,
   lives in graph `state`, persisted via a `checkpointer`) and long-term
   (cross-thread/session, lives in a `store`). Don't conflate them when advising
   the user.
4. **Structured output**: prefer `response_format=YourPydanticModel` and let
   LangChain pick `ProviderStrategy` (native) vs `ToolStrategy` (tool-call based)
   automatically; only hand-pick a strategy when there's a specific reliability or
   provider-support reason.
5. **For anything involving file/code/shell access, default to a sandboxed
   backend** (Deep Agents `FilesystemBackend(virtual_mode=True)`,
   `DockerExecutionPolicy`, or a remote sandbox) rather than raw host access,
   and say so explicitly — Deep Agents follows a "trust the LLM" model where
   the backend/sandbox is the actual security boundary, not the prompt.
6. **Version-sensitive code**: LangChain ships fast. When giving copy-paste code,
   mention that exact model name strings (e.g., `gpt-5.5`, `claude-sonnet-4-6`)
   and package versions may need adjusting to whatever is current, and that
   `pip install -U langchain` pulls the latest.

## Source of truth

All reference files in this skill were built directly from `docs.langchain.com`
(the unified LangChain/LangGraph/Deep Agents docs) and `reference.langchain.com`
(API reference) as of mid-2026. If the user's question concerns a very recent
change, a niche integration, or something not covered in the reference files,
web-search `docs.langchain.com` directly rather than relying on older training
data — LangChain's API surface (especially `langchain.agents.middleware` and
`deepagents`) changes faster than most frameworks.