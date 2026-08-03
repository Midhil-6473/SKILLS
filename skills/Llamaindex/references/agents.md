# Agents — FunctionAgent, AgentWorkflow, Tools, Memory, Multi-Agent

## What is an agent in LlamaIndex?

A semi-autonomous piece of software powered by an LLM, given a task, that executes a
series of steps to solve it:
1. Agent receives a message
2. LLM decides the next action using chat history, tools, and the latest message
3. Agent may invoke one or more tools
4. Agent interprets tool output, decides whether to continue or finish
5. Returns final result to the user

## FunctionAgent — the recommended starting point

```python
from llama_index.llms.openai import OpenAI
from llama_index.core.agent.workflow import FunctionAgent

def multiply(a: float, b: float) -> float:
    """Multiply two numbers and return the product."""
    return a * b

def add(a: float, b: float) -> float:
    """Add two numbers and return the sum."""
    return a + b

llm = OpenAI(model="gpt-4o-mini")

agent = FunctionAgent(
    tools=[multiply, add],
    llm=llm,
    system_prompt="You are an agent that performs basic math using tools.",
)

response = await agent.run(user_msg="What is 20+(2*4)?")
print(response)
```

**Critical detail:** docstrings and type hints matter. The agent uses the tool's name,
docstring, and type-hinted signature to decide whether/how to call it. Write descriptive
docstrings.

This is async-first code. In a script, wrap in:
```python
import asyncio
async def main():
    response = await agent.run(user_msg="...")
asyncio.run(main())
```
In Jupyter/FastAPI, `await` directly.

## Other agent types

```python
from llama_index.core.agent.workflow import ReActAgent   # ReAct prompting strategy
# from llama_index.core.agent.workflow import CodeActAgent  # generates/executes code as actions
```

`ReActAgent` uses explicit reasoning traces ("Thought: ... Action: ... Observation: ...") —
useful for models without native function-calling, or when you want visible reasoning.
`CodeActAgent` has the LLM write and execute Python code as its action mechanism (powerful
for data analysis tasks, requires sandboxing for safety).

## Using a QueryEngine as a tool (Agentic RAG)

This is the core pattern combining RAG with agents — letting the agent decide *when* to
retrieve, and reason across multiple retrievals.

```python
from llama_index.core.tools import QueryEngineTool, ToolMetadata

query_engine_tool = QueryEngineTool(
    query_engine=index.as_query_engine(),
    metadata=ToolMetadata(
        name="company_docs",
        description="Useful for answering questions about company policies and procedures.",
    ),
)

agent = FunctionAgent(
    tools=[query_engine_tool],
    llm=llm,
    system_prompt="Answer questions using the company_docs tool when relevant.",
)
response = await agent.run(user_msg="What's our PTO policy?")
```

## Using existing tools (LlamaHub tool registry)

```bash
pip install llama-index-tools-google      # Gmail, Calendar, etc.
pip install llama-index-tools-wikipedia
pip install llama-index-tools-code-interpreter
```

```python
from llama_index.tools.wikipedia import WikipediaToolSpec

tool_spec = WikipediaToolSpec()
tools = tool_spec.to_tool_list()
agent = FunctionAgent(tools=tools, llm=llm)
```

Browse all tools at `llamahub.ai`.

## Maintaining state — Context object

`FunctionAgent`/`AgentWorkflow` remember previous messages via the `Context` object.

```python
from llama_index.core.workflow import Context

ctx = Context(agent)

response = await agent.run(user_msg="My name is Alice", ctx=ctx)
response = await agent.run(user_msg="What's my name?", ctx=ctx)  # remembers "Alice"
```

Without passing `ctx`, each `.run()` call starts a fresh conversation.

### Custom state in Context

```python
from llama_index.core.workflow import JsonPickleSerializer

ctx = Context(agent)
async with ctx.store.edit_state() as state:
    state["user_preferences"] = {"language": "formal"}

# Persist context across sessions
ctx_dict = ctx.to_dict(serializer=JsonPickleSerializer())
# ... later ...
restored_ctx = Context.from_dict(agent, ctx_dict, serializer=JsonPickleSerializer())
```

## Streaming output and events

```python
handler = agent.run(user_msg="Research the history of LlamaIndex and summarize it")

async for event in handler.stream_events():
    if hasattr(event, "delta"):
        print(event.delta, end="", flush=True)

response = await handler   # final result after streaming completes
```

This lets you show live tool calls, reasoning, and partial text as the agent works —
critical for good UX in chat interfaces.

## Human in the loop

Pause agent execution to ask for human confirmation/input before a risky action (e.g.,
sending an email, executing a destructive operation):

```python
from llama_index.core.workflow import InputRequiredEvent, HumanResponseEvent

# Inside a custom tool or workflow step:
response_event = await ctx.wait_for_event(
    HumanResponseEvent,
    waiter_event=InputRequiredEvent(prefix="Confirm sending this email? (yes/no): "),
    requirements={"user_name": "human"},
)
```

The exact mechanics depend on whether you're in a workflow or a prebuilt agent — see
`workflows.md` for the full event-driven pattern.

## Multi-agent systems — AgentWorkflow

`AgentWorkflow` orchestrates multiple specialized agents collaborating on a task — each
agent can hand off control to another.

```python
from llama_index.core.agent.workflow import AgentWorkflow, FunctionAgent

research_agent = FunctionAgent(
    name="ResearchAgent",
    description="Searches for information on a topic",
    tools=[search_tool],
    llm=llm,
    system_prompt="You are a research agent. Find relevant information.",
    can_handoff_to=["WriteAgent"],
)

write_agent = FunctionAgent(
    name="WriteAgent",
    description="Writes content based on research",
    tools=[],
    llm=llm,
    system_prompt="You are a writing agent. Draft content from provided research.",
    can_handoff_to=["ResearchAgent"],
)

workflow = AgentWorkflow(
    agents=[research_agent, write_agent],
    root_agent="ResearchAgent",
)

response = await workflow.run(user_msg="Write a short report on LlamaIndex's history")
```

Each agent declares which other agents it `can_handoff_to`. The LLM decides when to hand
off based on the task and each agent's `description`. This is conceptually similar to
LangGraph's "swarm" pattern (see `integrations.md`).

### Multi-agent patterns summary

| Pattern | How it works | When to use |
|---|---|---|
| **AgentWorkflow handoffs** | Agents directly transfer control to each other | Flexible, fast collaboration between known agents |
| **Orchestrator/Planner** | One agent plans and dispatches subtasks to others, aggregates results | Centralized control, clearer audit trail |
| **Custom Workflow** | Hand-build the multi-agent graph with explicit steps/events | Maximum control, complex conditional logic |

For more rigid orchestration (explicit control flow rather than LLM-decided handoffs),
drop down to a custom `Workflow` — see `workflows.md`.

## Using Structured Output with agents

```python
from pydantic import BaseModel
from llama_index.core.agent.workflow import FunctionAgent

class WeatherReport(BaseModel):
    location: str
    temperature_f: float
    conditions: str

agent = FunctionAgent(
    tools=[get_weather_tool],
    llm=llm,
    output_cls=WeatherReport,    # Forces structured final output
)
response = await agent.run(user_msg="What's the weather in Austin?")
weather: WeatherReport = response.structured_response
```

## Memory modules (long-term / cross-session)

```python
from llama_index.core.memory import ChatMemoryBuffer

memory = ChatMemoryBuffer.from_defaults(token_limit=3000)
chat_engine = index.as_chat_engine(chat_mode="context", memory=memory)
```

For agents specifically:
```python
from llama_index.core.memory import Memory

memory = Memory.from_defaults(session_id="user_123", token_limit=4000)
agent = FunctionAgent(tools=tools, llm=llm)
response = await agent.run(user_msg="Hi, remember my name is Bob", memory=memory)
```

`Memory` can be backed by a persistent chat store (Redis, Postgres, etc.) for true
cross-session memory — see `module_guides/storing/chat_stores/` in the official docs.