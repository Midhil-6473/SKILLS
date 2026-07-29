# Agents — Reference (`create_agent`)

> An agent is a model calling tools in a loop until a stop condition is met.
> `create_agent` builds this as a **graph-based** runtime on LangGraph: nodes for
> the model, nodes for tools, and middleware hooks woven through both.

## Minimal agent

```python
from langchain.agents import create_agent
from langchain.tools import tool

@tool
def search(query: str) -> str:
    """Search for information."""
    return f"Results for: {query}"

agent = create_agent("openai:gpt-5.4", tools=[search])
```

If `tools=[]` (or omitted), the agent is just a single LLM node with no tool loop.

## The ReAct loop

Agents alternate brief reasoning with targeted tool calls ("Reasoning + Acting"),
feeding each tool result back in until they can answer:

```
Human: Find the most popular wireless headphones and check stock
  → reasoning: need to search → calls search_products(...)
  → tool result: top result is WH-1000XM5
  → reasoning: need to confirm stock → calls check_inventory(...)
  → tool result: 10 units in stock
  → final answer
```

## Model — static vs dynamic

**Static** (set once, most common):
```python
agent = create_agent("openai:gpt-5.4", tools=tools)
# or, for full param control:
from langchain_openai import ChatOpenAI
model = ChatOpenAI(model="gpt-5.4", temperature=0.1, max_tokens=1000, timeout=30)
agent = create_agent(model, tools=tools)
```

**Dynamic** (chosen at runtime via middleware — see `middleware.md` for the full
hook reference):
```python
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse

@wrap_model_call
def dynamic_model_selection(request: ModelRequest, handler) -> ModelResponse:
    model = advanced_model if len(request.state["messages"]) > 10 else basic_model
    return handler(request.override(model=model))

agent = create_agent(model=basic_model, tools=tools, middleware=[dynamic_model_selection])
```

## Tools

**Static tools** — defined up front, unchanged through execution (the common case).
Agents add multi-step sequencing, parallel calls, dynamic selection, retries, and
state persistence on top of plain `bind_tools`.

```python
from langchain.tools import tool

@tool
def get_weather(location: str) -> str:
    """Get weather information for a location."""
    return f"Weather in {location}: Sunny, 72°F"

agent = create_agent(model, tools=[search, get_weather])
```

**Dynamic tools** — the available toolset changes at runtime. Two cases:

1. *Filtering pre-registered tools* (all tools known ahead of time, but exposure
   depends on auth/permissions/feature flags/conversation stage). Use
   `@wrap_model_call` to read `request.state`, `request.runtime.store`, or
   `request.runtime.context` and call `request.override(tools=filtered_tools)`.

   ```python
   from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse

   @wrap_model_call
   def state_based_tools(request: ModelRequest, handler) -> ModelResponse:
       is_authenticated = request.state.get("authenticated", False)
       if not is_authenticated:
           tools = [t for t in request.tools if t.name.startswith("public_")]
           request = request.override(tools=tools)
       return handler(request)

   agent = create_agent(model="gpt-5.4", tools=[public_search, private_search],
                         middleware=[state_based_tools])
   ```

2. *Runtime tool registration* (tools discovered at runtime — MCP servers,
   generated tools, remote registries). Requires **two** hooks: `wrap_model_call`
   to add the tool to the request, and `wrap_tool_call` to actually execute it
   (the agent has no other way to know how to run a tool that wasn't in the
   original list).

   ```python
   from langchain.agents.middleware import AgentMiddleware

   class DynamicToolMiddleware(AgentMiddleware):
       def wrap_model_call(self, request, handler):
           updated = request.override(tools=[*request.tools, calculate_tip])
           return handler(updated)

       def wrap_tool_call(self, request, handler):
           if request.tool_call["name"] == "calculate_tip":
               return handler(request.override(tool=calculate_tip))
           return handler(request)

   agent = create_agent(model="gpt-4o", tools=[get_weather], middleware=[DynamicToolMiddleware()])
   ```

**Tool error handling** via `@wrap_tool_call`:
```python
from langchain.agents.middleware import wrap_tool_call
from langchain.messages import ToolMessage

@wrap_tool_call
def handle_tool_errors(request, handler):
    try:
        return handler(request)
    except Exception as e:
        return ToolMessage(content=f"Tool error: {e}", tool_call_id=request.tool_call["id"])

agent = create_agent(model="gpt-5.4", tools=[search, get_weather], middleware=[handle_tool_errors])
```

## System prompt

```python
agent = create_agent(model, tools, system_prompt="You are a helpful assistant. Be concise.")
```
If omitted, the agent infers its task from the messages alone. Pass a
`SystemMessage` instead of a string when you need structured content blocks
(e.g., Anthropic prompt-caching `cache_control`).

**Dynamic system prompt** via `@dynamic_prompt`:
```python
from langchain.agents.middleware import dynamic_prompt, ModelRequest

@dynamic_prompt
def user_role_prompt(request: ModelRequest) -> str:
    role = request.runtime.context.get("user_role", "user")
    base = "You are a helpful assistant."
    return f"{base} Provide detailed technical responses." if role == "expert" else base

agent = create_agent(model="gpt-5.4", tools=[web_search], middleware=[user_role_prompt], context_schema=Context)
result = agent.invoke({"messages": [...]}, context={"user_role": "expert"})
```

## Name

```python
agent = create_agent(model, tools, name="research_assistant")
```
Used as the node id when nesting the agent in a multi-agent graph. Use
`snake_case` — some providers reject spaces/special characters in names (same
rule applies to tool names).

## Invocation

```python
result = agent.invoke({"messages": [{"role": "user", "content": "What's the weather in SF?"}]})
```
Agents follow the full LangGraph Graph API — `invoke`, `stream`, etc. all work.

## Streaming

```python
from langchain.messages import AIMessage, HumanMessage

for chunk in agent.stream({"messages": [{"role": "user", "content": "Search for AI news"}]}, stream_mode="values"):
    latest = chunk["messages"][-1]
    if latest.content:
        print(latest.content)
    elif latest.tool_calls:
        print(f"Calling tools: {[tc['name'] for tc in latest.tool_calls]}")
```

## Structured output (`response_format`)

**ToolStrategy** — works with any tool-calling model, uses an artificial tool call:
```python
from pydantic import BaseModel
from langchain.agents.structured_output import ToolStrategy

class ContactInfo(BaseModel):
    name: str
    email: str
    phone: str

agent = create_agent(model="gpt-5.4-mini", tools=[search_tool], response_format=ToolStrategy(ContactInfo))
result = agent.invoke({"messages": [...]})
result["structured_response"]  # ContactInfo(...)
```

**ProviderStrategy** — uses the provider's native structured-output feature (more
reliable, narrower provider support):
```python
from langchain.agents.structured_output import ProviderStrategy
agent = create_agent(model="gpt-5.4", response_format=ProviderStrategy(ContactInfo))
```

As of `langchain 1.0`, just passing `response_format=ContactInfo` auto-selects
`ProviderStrategy` if supported, falling back to `ToolStrategy` otherwise.

## Memory (short-term, via state) — full reference in `memory.md`

Custom state beyond the message list, two ways:

```python
# Preferred: via middleware (keeps the extension scoped)
from langchain.agents import AgentState
from langchain.agents.middleware import AgentMiddleware

class CustomState(AgentState):
    user_preferences: dict

class CustomMiddleware(AgentMiddleware):
    state_schema = CustomState
    tools = [tool1, tool2]
    def before_model(self, state, runtime):
        ...

agent = create_agent(model, tools=tools, middleware=[CustomMiddleware()])
```

```python
# Shortcut: via state_schema directly on create_agent (tools-only use cases)
from langchain.agents import AgentState

class CustomState(AgentState):
    user_preferences: dict

agent = create_agent(model, tools=[tool1, tool2], state_schema=CustomState)
```

As of `langchain 1.0`, custom state schemas **must** be `TypedDict` (Pydantic
models / dataclasses are no longer supported for this).

## Middleware

See `middleware.md` for the complete hook list and all prebuilt middleware. In
short: middleware is how `create_agent` stays a minimal core while still
supporting prompt engineering, guardrails, retries, dynamic routing, summarization,
filesystem access, and subagents — all without forking the agent loop.

```python
from langchain.agents.middleware import SummarizationMiddleware, HumanInTheLoopMiddleware

agent = create_agent(
    model="gpt-5.4", tools=[...],
    middleware=[SummarizationMiddleware(...), HumanInTheLoopMiddleware(...)],
)
```

## Embedding an agent inside a larger LangGraph

Middleware is not a separate runtime — hooks run inside the compiled graph
`create_agent` returns, so you can drop the whole agent (with all its
middleware) into a bigger `StateGraph` as a node or subgraph:

```python
from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.graph import START, StateGraph

email_agent = create_agent(
    model="claude-sonnet-4-6", tools=[read_email, send_email],
    middleware=[HumanInTheLoopMiddleware(interrupt_on={"send_email": True})],
)

graph = (
    StateGraph(AgentState)
    .add_node("classify", classify_node)
    .add_node("email_agent", email_agent)
    .add_edge(START, "classify")
    .add_conditional_edges("classify", route)
    .compile()
)
```
Reach for this when the topology is more than "loop until done" — classify-then-
route, fan-out parallel work, or deterministic + agentic steps stitched together.