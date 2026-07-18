---
name: pydantic-architect
description: >
  Complete architect's manual for Pydantic — both Pydantic Validation (the Python
  data validation library underlying FastAPI, LangChain, and most of the AI
  ecosystem) and Pydantic AI (the Pydantic team's type-safe agent framework). Use
  whenever the user asks about Pydantic, BaseModel, data validation, field/model
  validators, pydantic-settings, or Pydantic AI: building agents, structured
  outputs, tool calling, dependency injection, multi-agent workflows, pydantic-graph,
  streaming agent responses, connecting agents to FastAPI, or using Pydantic AI
  alongside LangChain/LangGraph. Also trigger for beginner questions like what
  Pydantic is, why type hints alone aren't validation, Pydantic vs dataclasses, or
  Pydantic AI vs LangChain/LangGraph — which framework to pick for a given project.
---

# The Pydantic Architect's Manual (Validation + Pydantic AI)

You are acting as an expert Python/AI engineer specializing in Pydantic. "Pydantic"
today means two related but distinct things, and this skill covers both:

1. **Pydantic Validation** — the data validation library (the `pydantic` package,
   currently v2) that turns Python type hints into real runtime validation,
   coercion, and serialization. It's the validation layer underneath FastAPI, and
   underneath virtually every major agent framework's structured output —
   including the OpenAI SDK, Anthropic SDK, LangChain, LlamaIndex, CrewAI, and
   Instructor.
2. **Pydantic AI** — a Python **agent framework** (the `pydantic-ai` package) built
   by the same team, explicitly designed to bring "the FastAPI feeling" to agentic
   AI development: agents as typed Python objects, structured outputs validated by
   Pydantic models instead of parsed strings, and dependency injection instead of
   global state.

## Why type hints alone aren't validation

```python
def greet(name: str) -> str:
    return f"Hello, {name}"

greet(42)  # runs fine at runtime — Python does NOT enforce type hints
```

Type hints are documentation and static-analysis input (for mypy/pyright) — nothing
stops a caller from passing the wrong type at runtime. The moment your program
touches the outside world — JSON from an API, an LLM's tool-call arguments, rows
from a CSV, environment variables — you need **actual runtime validation**. That's
what Pydantic adds: declare the shape once with type hints, and get real validation,
coercion, helpful errors, and serialization, at Rust-speed (Pydantic v2's core is
written in Rust via `pydantic-core`, 5-50x faster than v1).

## Quick-start: validation

```python
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str
    is_active: bool = True

user = User(id="123", name="Ada Lovelace")  # "123" coerced to int 123
print(user.id)          # 123 (an int)
print(user.model_dump())  # {'id': 123, 'name': 'Ada Lovelace', 'is_active': True}
```

## Quick-start: an agent with Pydantic AI

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class WeatherReport(BaseModel):
    location: str
    temperature_f: float
    conditions: str

agent = Agent(
    "anthropic:claude-sonnet-4-6",
    output_type=WeatherReport,
    system_prompt="You are a weather assistant.",
)

result = agent.run_sync("What's the weather like in Boston?")
print(result.output)   # a validated WeatherReport instance, not a string to parse
```

The core idea across both halves of this skill: **stop parsing strings, start
receiving validated objects** — whether that's an incoming API request body or an
LLM's final answer.

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Pydantic Validation fundamentals: BaseModel, Field, type coercion, nested models, serialization | `references/validation_fundamentals.md` |
| Validators: `@field_validator`, `@model_validator`, before/after/wrap modes, cross-field validation | `references/validators.md` |
| Settings management: `pydantic-settings`, env vars, `.env` files, nested config | `references/settings_management.md` |
| Pydantic AI core concepts: Agent, output_type, system prompts, running agents (sync/async/streaming) | `references/pydantic_ai_agents.md` |
| Tools and dependency injection: `@agent.tool`, `RunContext`, typed deps, testing with mock deps | `references/tools_and_dependencies.md` |
| Structured outputs in depth: output_type strategies, validation retries, unions, output tools | `references/structured_outputs.md` |
| Multi-agent workflows: agent delegation, `pydantic-graph` for stateful workflows, when to reach for LangGraph instead | `references/multi_agent_workflows.md` |
| Connecting to FastAPI: request/response models, streaming agent responses (SSE/WebSocket), a full backend pattern | `references/fastapi_integration.md` |
| Using Pydantic AI alongside LangChain/LangGraph/MCP; Pydantic Validation inside other frameworks | `references/framework_integration.md` |
| Observability and evals: Logfire, OpenTelemetry, Pydantic Evals for testing agent quality | `references/observability_and_evals.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Reach for Pydantic when data crosses a trust boundary** — APIs, files, config,
   user input, LLM outputs. If data never leaves your own code (created and
   consumed entirely internally), a plain dataclass is lighter and sufficient;
   Pydantic earns its keep specifically at the edges.
2. **Use `@field_validator` for single-field logic, `@model_validator(mode="after")`
   for cross-field logic** — and always `return self` from an after-mode model
   validator, and `return value` from a field validator.
3. **Set `model_config = ConfigDict(extra="forbid")`** on any model validating
   external input (especially config files) to catch typos as hard errors instead
   of silently ignored unknown fields.
4. **Don't over-type structured outputs.** If an agent just needs to return a
   string or a bool, use `output_type=str` — reserve full Pydantic models for
   outputs with real internal structure. Overly strict schemas cause unnecessary
   validation-retry token cost.
5. **Use dependency injection (`deps_type` + `RunContext`) instead of module-level
   globals** for anything a tool needs (DB connections, API clients, user context)
   — this is what makes Pydantic AI agents genuinely unit-testable with mock deps.
6. **Default to Pydantic AI for new FastAPI-based agent projects**; reach for
   LangGraph specifically when you need complex, cyclic, multi-agent graphs with
   persistent checkpointed state — the two are not mutually exclusive, and using
   Pydantic AI for core agent logic inside a larger LangGraph graph is a valid,
   fairly common pattern.
7. **Never bypass validation "for performance" on data crossing a real trust
   boundary** — Pydantic v2's Rust core is fast enough that validation is rarely
   the actual bottleneck; a malformed payload silently corrupting downstream data
   is a far more expensive failure mode than the validation cost.
8. **Source of truth:** `pydantic.dev/docs`. Pydantic AI in particular is evolving
   quickly (composable "capabilities," durable execution, YAML/JSON-defined agents)
   — web-search current docs for anything version-specific rather than assuming an
   older pattern still applies.