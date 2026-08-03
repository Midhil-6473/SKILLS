# Pydantic AI vs. and alongside LangChain / LangGraph / MCP

## The honest framework comparison (2026)

| | Pydantic AI | LangChain | LangGraph |
|---|---|---|---|
| **Philosophy** | "FastAPI feeling" — typed, minimal, explicit | Breadth — hundreds of integrations, rapid prototyping | Explicit stateful graphs for complex control flow |
| **Type safety** | Full generics (`Agent[Deps, OutputType]`), output validated against real Pydantic models | `TypedDict` state, output typing largely optional/bypassable | `TypedDict` + `Annotated`, stronger than base LangChain but not full Pydantic validation |
| **Learning curve** | Low for developers who know Pydantic/FastAPI — no new DSL | Moderate — LCEL, the Runnable protocol | High — graph-building concepts, checkpointing |
| **Ecosystem size** | Smaller, deliberate (~major providers + growing tool ecosystem) | Very large — 600+ integrations, vector stores, loaders | Inherits LangChain's ecosystem when combined |
| **Multi-agent** | Manual delegation or `pydantic-graph` — no built-in role/handoff primitives | Manual, via LangChain tools | Native — supervisor/swarm patterns, mature |
| **Observability** | Pydantic Logfire (OpenTelemetry-based), or any OTel backend | LangSmith (freemium SaaS) | LangSmith |
| **Maturity** | v1.0 API-stable since September 2025; newer overall (public debut late 2024) | Battle-tested since early 2023 | Production since early 2024, now v1.0 |

**The commonly-repeated 2026 guidance, worth stating plainly**: there is no
universal winner. Pydantic AI wins on type safety, developer experience, and
FastAPI-native fit; LangChain wins on ecosystem breadth and pre-built integrations;
LangGraph wins specifically for complex, cyclic, stateful multi-agent workflows.
**Many teams use more than one of these together rather than treating the choice
as exclusive.**

## When to default to Pydantic AI

- You're building a new **FastAPI** application — the architectural philosophy
  aligns directly, and request/response models can be reused as agent
  dependencies/outputs.
- **Type safety matters** to your team — you want IDE autocomplete and
  compile-time-like guarantees on agent inputs/outputs, not `Any` everywhere.
- You want **clean, mock-based testing** without patching globals (see
  `tools_and_dependencies.md`).
- You want **minimal dependencies** — Pydantic AI is deliberately lightweight
  compared to the full LangChain stack.
- You're doing **single-agent, structured-output-heavy work** (extraction,
  classification, structured generation) — this is squarely Pydantic AI's
  strength.

## When to reach for LangChain instead (or alongside)

- You need **specific pre-built integrations** — document loaders, particular
  vector store connectors, retrieval chains — that LangChain already has and
  Pydantic AI doesn't.
- Your team already has **LangChain expertise** — migration cost is real and
  should be weighed against Pydantic AI's benefits for a given project.
- You need **LangSmith specifically** — its prompt management, evaluation
  suites, and team collaboration features are LangChain-ecosystem-native.

## When to reach for LangGraph specifically

- **Complex, cyclic, multi-agent workflows** with conditional routing — this
  remains LangGraph's clear strength as of 2026 (see `multi_agent_workflows.md`
  for the honest comparison with `pydantic-graph`).
- You need **mature, production-tested checkpointing/persistence** across
  long-running or interrupted agent runs.
- You're building a **supervisor/swarm multi-agent architecture** — LangGraph has
  native, well-documented patterns for this that Pydantic AI currently lacks as
  built-in primitives.

## Using Pydantic Validation *inside* LangChain (it's already there)

A detail worth knowing explicitly: **Pydantic Validation is the validation layer
underneath LangChain itself**, along with the OpenAI SDK, Anthropic SDK, Google
ADK, LlamaIndex, AutoGPT, Transformers, CrewAI, and Instructor. If you're using
LangChain's structured output features at all, you're already using Pydantic
underneath — this skill's `validation_fundamentals.md` and `validators.md`
material applies directly to writing better LangChain structured-output schemas,
regardless of whether you ever touch the separate `pydantic-ai` package.

```python
# LangChain structured output — the schema itself is plain Pydantic, no pydantic-ai needed
from pydantic import BaseModel, field_validator
from langchain.chat_models import init_chat_model

class ExtractedEntity(BaseModel):
    name: str
    entity_type: str

    @field_validator("entity_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in {"person", "organization", "location"}:
            raise ValueError(f"Unknown entity type: {v}")
        return v

model = init_chat_model("claude-sonnet-4-6")
structured_model = model.with_structured_output(ExtractedEntity)
```

## MCP support — built into Pydantic AI

Pydantic AI has built-in **Model Context Protocol** client support — connecting an
agent to MCP servers as a tool source requires no separate adapter package (unlike
LangChain, which uses `langchain-mcp-adapters` — see this skill collection's
`mcp-architect` skill).

```python
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio, MCPServerStreamableHTTP

filesystem_server = MCPServerStdio(
    command="uv",
    args=["--directory", "/path/to/mcp-server", "run", "server.py"],
)

remote_server = MCPServerStreamableHTTP(url="https://your-mcp-server.com/mcp")

agent = Agent("claude-sonnet-4-6", toolsets=[filesystem_server, remote_server])

async with agent:   # MCP servers connect on agent context entry, disconnect on exit
    result = await agent.run("List the files in the project directory")
```

MCP tools become available to the agent alongside any regular `@agent.tool`
functions, with no protocol-translation code needed — see this skill collection's
`mcp-architect` skill for the server-building side of this connection.

## A2A protocol support

Pydantic AI also has built-in support for the **A2A (Agent-to-Agent) protocol** —
see `mcp-architect`'s `ecosystem_and_a2a.md` for what A2A is and how it
differs from MCP (tool/data access vs. agent-to-agent delegation). This gives
Pydantic AI agents a standardized way to both expose themselves to, and consume,
other A2A-compatible agents across framework/organization boundaries.

## Decision guide

| Situation | Recommendation |
|---|---|
| New FastAPI project, want type safety, single or lightly-multi-agent | Pydantic AI |
| Need a specific LangChain integration (loader, vector store) not available elsewhere | LangChain, possibly alongside Pydantic AI for the agent layer itself |
| Complex cyclic multi-agent graph, need mature checkpointing | LangGraph (optionally with Pydantic AI inside individual nodes — see `multi_agent_workflows.md`) |
| Already deep in LangChain, agents need MCP tools | `langchain-mcp-adapters` (see `mcp-architect`) |
| Building fresh, agents need MCP tools | Pydantic AI's built-in `MCPServerStdio`/`MCPServerStreamableHTTP` — no adapter package needed |
| Just need better-validated structured output from any framework | Plain Pydantic Validation — already underneath whichever framework you're using |

## Practical guidance

1. **Don't treat framework choice as a multi-week research project** — the
   commonly-repeated advice across the ecosystem is to pick one, build a
   prototype, and switch if needed; the core agent logic is largely
   framework-agnostic, and it's the "plumbing" that differs.
2. **Default to Pydantic AI for new FastAPI-native projects**; reach for
   LangGraph specifically for complex multi-agent graphs; don't assume it's
   exclusively one or the other.
3. **Remember Pydantic Validation is already inside LangChain** — improving your
   Pydantic model design pays off there too, independent of any `pydantic-ai`
   adoption decision.
4. **Use Pydantic AI's built-in MCP support** when starting fresh — it avoids an
   extra adapter package that LangChain requires for the same capability.