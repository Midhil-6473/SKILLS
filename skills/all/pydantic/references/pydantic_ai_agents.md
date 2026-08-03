# Pydantic AI — Core Agent Concepts

## What Pydantic AI is

A Python agent framework, built by the Pydantic team, aiming to bring "the FastAPI
feeling" to GenAI development. Where FastAPI made web APIs feel like normal typed
Python functions (instead of manual request parsing), Pydantic AI does the same for
LLM agents: **an agent is a typed Python object, tool calls are decorated
functions, and outputs are validated Pydantic models instead of strings you parse
yourself.**

```bash
pip install pydantic-ai
pip install "pydantic-ai[anthropic]"   # provider-specific extras as needed
```

## The minimal agent

```python
from pydantic_ai import Agent

agent = Agent("anthropic:claude-sonnet-4-6")
result = agent.run_sync("Why is the sky blue?")
print(result.output)   # a plain string response
```

Model names are strings in `"provider:model"` form (or just the model name for
some providers) — **swapping models is a one-line change**, with the tool
interface, dependency injection, and streaming API identical across every
supported provider:

```python
agent = Agent("anthropic:claude-sonnet-4-6")
agent = Agent("openai:gpt-5.5")
agent = Agent("google-gla:gemini-2.5-pro")
agent = Agent("ollama:llama3.2")           # local models
```

Pydantic AI supports 20+ providers: OpenAI, Anthropic, Gemini, DeepSeek, Grok,
Cohere, Mistral, Perplexity, Azure AI Foundry, Amazon Bedrock, Google Cloud,
Ollama, LiteLLM, Groq, OpenRouter, Together AI, Fireworks, and more.

## Structured output — the headline feature

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class ReviewResult(BaseModel):
    sentiment: str
    confidence: float
    key_issues: list[str]

agent = Agent(
    "claude-sonnet-4-6",
    output_type=ReviewResult,
    system_prompt="You are a code review assistant. Analyze the given code.",
)

result = agent.run_sync("def add(a,b): return a+b")
review: ReviewResult = result.output   # a validated ReviewResult instance, not a string
print(review.sentiment, review.confidence)
```

`result.output` is a real, validated instance of your Pydantic model — the LLM's
response is validated against your schema, and **if validation fails, Pydantic AI
automatically retries with the validation error fed back to the model**, rather
than surfacing malformed data to your application. See `structured_outputs.md` for
the retry mechanics and advanced output strategies.

## System prompts — static and dynamic

```python
agent = Agent(
    "claude-sonnet-4-6",
    system_prompt="You are a helpful assistant for Acme Corp customers.",   # static
)
```

```python
from pydantic_ai import Agent, RunContext
from dataclasses import dataclass

@dataclass
class SupportDeps:
    user_name: str
    tier: str

agent = Agent("claude-sonnet-4-6", deps_type=SupportDeps)

@agent.instructions   # dynamic — computed per-run, can use injected dependencies
async def add_user_context(ctx: RunContext[SupportDeps]) -> str:
    return f"You are speaking with {ctx.deps.user_name}, a {ctx.deps.tier}-tier customer."
```

Dynamic instructions (via `@agent.instructions`) can incorporate runtime
dependencies (see `tools_and_dependencies.md`) — useful for per-user or
per-request context that a static string can't express.

## Running an agent — sync, async, and streaming

```python
# Synchronous — for scripts, notebooks, simple cases
result = agent.run_sync("What's 2+2?")

# Async — the standard choice inside FastAPI endpoints or any async context
result = await agent.run("What's 2+2?")

# Streaming — token-by-token, for chat UIs (see fastapi_integration.md for the full pattern)
async with agent.run_stream("Tell me a story") as response:
    async for chunk in response.stream_text():
        print(chunk, end="", flush=True)
```

**Use `run_sync` in scripts and tests; use `run` (async) in FastAPI endpoints, web
apps, or anywhere already running an event loop** — mixing sync calls into an
async context blocks the event loop unnecessarily.

## Multi-turn conversations — passing message history

```python
result1 = agent.run_sync("My name is Alice")
result2 = agent.run_sync("What's my name?", message_history=result1.all_messages())
print(result2.output)   # correctly recalls "Alice", since history was passed explicitly
```

Pydantic AI doesn't maintain conversation state implicitly — **you explicitly pass
`message_history` from a previous result** to continue a conversation. This
explicitness is deliberate: it makes state management visible and testable rather
than hidden inside the framework, and it's straightforward to persist
`result.all_messages()` to a database between turns for a real chat application
(see `fastapi_integration.md`).

## Model settings — temperature, max_tokens, timeouts

```python
from pydantic_ai.settings import ModelSettings

agent = Agent(
    "claude-sonnet-4-6",
    model_settings=ModelSettings(temperature=0.2, max_tokens=1024, timeout=30),
)

# Override per-run
result = agent.run_sync("...", model_settings=ModelSettings(temperature=0.9))
```

Settings apply with a clear precedence: model-level defaults → agent-level
defaults (merged, agent wins conflicts) → run-time overrides (highest priority,
merged over both).

## Streaming events — fine-grained visibility into agent execution

```python
from pydantic_ai import (
    Agent, FunctionToolCallEvent, FunctionToolResultEvent,
    PartStartEvent, PartDeltaEvent, TextPartDelta, FinalResultEvent,
)

async with agent.iter("What's the weather in Boston?") as agent_run:
    async for node in agent_run:
        if Agent.is_model_request_node(node):
            async with node.stream(agent_run.ctx) as request_stream:
                async for event in request_stream:
                    if isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                        print(event.delta.content_delta, end="")
        elif Agent.is_call_tools_node(node):
            async with node.stream(agent_run.ctx) as tools_stream:
                async for event in tools_stream:
                    if isinstance(event, FunctionToolCallEvent):
                        print(f"\n[calling {event.part.tool_name}]")
```

This event-level API is what powers structured agentic UIs (tool call
visualization, live reasoning display) — see this skill collection's
`react-ai-architect` skill for the frontend rendering side of exactly this pattern.

## Handling interrupted runs

```python
# Partial ModelResponse/ModelRequest messages have state='interrupted' when a run
# is cut short by an exception, a tool failure, or external cancellation —
# persistence layers and UIs can distinguish these from complete messages.
```

If streaming is interrupted mid-response (an exception, a cancelled request), the
partial state is still captured rather than lost — completed tool calls remain in
the message history even if a later step in the same run failed, which matters for
building a UI that can show "this partially completed" rather than nothing at all.

## Practical guidance

1. **Model strings are swappable in one line** — design agent code without
   hardcoding assumptions about a specific provider's quirks where avoidable.
2. **Use `run_sync` only in scripts/tests; use `run` (async) in any real
   application context.**
3. **Explicitly manage `message_history`** — don't expect implicit session state;
   persist and pass it yourself for multi-turn conversations.
4. **Don't over-type `output_type`** — a plain string output (the default, no
   `output_type` needed) is fine when there's no real internal structure to the
   answer; reserve Pydantic models for outputs your application code needs to
   process programmatically.