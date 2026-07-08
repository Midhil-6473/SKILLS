# Integrating MCP with LangChain, LangGraph, and FastAPI

## Why this matters

MCP standardizes *tool access*; LangChain/LangGraph standardize *agent
orchestration*. They're complementary layers, not competitors — a common and
powerful production pattern is: **MCP servers as the tool source, LangGraph as the
orchestration/reasoning layer.**

## LangChain — consuming MCP servers as tools

```bash
pip install langchain-mcp-adapters
```

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "weather": {
        "command": "uv",
        "args": ["--directory", "/path/to/weather-server", "run", "weather.py"],
        "transport": "stdio",
    },
    "github": {
        "url": "https://your-github-mcp-server.com/mcp",
        "transport": "streamable_http",
    },
})

tools = await client.get_tools()  # returns LangChain-compatible BaseTool objects
```

```python
from langchain.agents import create_agent

agent = create_agent("claude-sonnet-4-6", tools=tools)
result = await agent.ainvoke({"messages": [{"role": "user", "content": "What's the weather in Boston?"}]})
```

`langchain-mcp-adapters` handles the protocol translation — MCP tool schemas become
standard LangChain `BaseTool` objects automatically, so `create_agent` (or any
LangChain/LangGraph agent) uses them exactly like natively-defined tools. This is the
standard integration path if you're already using LangChain's agent framework — see
this skill collection's `langchain-architect` skill for the agent-building side of
this pattern in depth.

## LangGraph — MCP tools inside a custom graph

```python
from langgraph.prebuilt import ToolNode
from langgraph.graph import StateGraph, MessagesState, START

tools = await client.get_tools()  # from MultiServerMCPClient, as above
tool_node = ToolNode(tools)

graph = (
    StateGraph(MessagesState)
    .add_node("agent", agent_node)
    .add_node("tools", tool_node)
    .add_edge(START, "agent")
    # ... conditional routing as normal
    .compile()
)
```

Because `langchain-mcp-adapters` produces standard LangChain tools, they drop
directly into `ToolNode` — no special handling needed inside the graph itself. See
the `langchain-architect` skill's `langgraph_multiagent.md` for the broader graph
patterns this fits into.

## Exposing your own FastAPI backend's capabilities as an MCP server

If you already have a FastAPI backend (see this skill collection's
`react-ai-architect` skill), you can expose selected capabilities as MCP tools
**without duplicating logic** — wrap your existing service functions.

```python
from fastapi import FastAPI
from mcp.server.fastmcp import FastMCP

app = FastAPI()
mcp = FastMCP("MyAppServer")

# Reuse your existing business logic — don't reimplement it for MCP
from services.orders import get_order_by_id, create_order

@mcp.tool()
def lookup_order(order_id: str) -> dict:
    """Look up an order by its ID."""
    order = get_order_by_id(order_id)
    if order is None:
        return {"error": "ORDER_NOT_FOUND"}
    return order.to_dict()

@mcp.tool()
def place_order(customer_id: str, items: list[dict]) -> dict:
    """Place a new order for a customer."""
    order = create_order(customer_id, items)
    return order.to_dict()

# Mount the MCP server into the same FastAPI app, alongside your normal REST routes
app.mount("/mcp", mcp.streamable_http_app())
```

This single FastAPI process now serves **both** your normal REST API (for your React
frontend, say) **and** an MCP endpoint (for Claude, Claude Code, or any other MCP
host) — both backed by the exact same underlying service functions, avoiding
duplicated business logic between "the API for humans/frontends" and "the API for
AI agents."

## Using MCP tools inside your own FastAPI-hosted agent loop

If you're building a custom agent endpoint (rather than using LangChain's
`create_agent`), connect to MCP servers directly with the low-level client and
dispatch tool calls manually:

```python
from mcp import Client

mcp_client = Client("http://localhost:8001/mcp")

@app.post("/api/agent/run")
async def run_agent(request: AgentRequest):
    async with mcp_client:
        mcp_tools = await mcp_client.list_tools()
        anthropic_tools = [convert_mcp_tool_to_anthropic_format(t) for t in mcp_tools.tools]

        response = client.messages.create(
            model="claude-sonnet-4-6", tools=anthropic_tools,
            messages=request.messages,
        )
        for block in response.content:
            if block.type == "tool_use":
                result = await mcp_client.call_tool(block.name, block.input)
                # feed result back into the conversation, continue the loop
```

For production agent loops, prefer letting LangChain's `create_agent` (with
`langchain-mcp-adapters`) or Claude's native `mcp_servers` API parameter (see
`building_clients.md`) handle this translation rather than hand-rolling it — the
manual pattern above is mainly useful for understanding what those abstractions do
under the hood, or for genuinely custom agent loops that don't fit either.

## Streaming MCP tool calls into a React frontend

Combining this with the SSE streaming pattern from `react-ai-architect`'s
`fastapi_llm_gateway.md`:

```python
@app.post("/api/agent/stream")
async def stream_agent(request: AgentRequest):
    async def generate():
        async with mcp_client:
            mcp_tools = await mcp_client.list_tools()
            # ... agent loop, translating MCP tool calls into the same
            # structured SSE event schema (tool_call_start/tool_call_result/token)
            # described in react-ai-architect's agentic_ui_patterns.md
            yield f"event: tool_call_start\ndata: {json.dumps({'name': tool_name, 'args': args})}\n\n"
            result = await mcp_client.call_tool(tool_name, args)
            yield f"event: tool_call_result\ndata: {json.dumps({'result': str(result)})}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

This is the connective tissue between this skill and `react-ai-architect`: MCP
supplies the tool layer, FastAPI orchestrates and streams, React renders the agentic
UI — the same structured event schema pattern applies regardless of whether tools
come from MCP servers or are defined inline.

## Practical guidance

1. **Use `langchain-mcp-adapters` as the default bridge** between MCP servers and
   LangChain/LangGraph agents — don't hand-roll protocol translation unless you have
   a specific reason to.
2. **Mount an MCP server directly into an existing FastAPI app** when you want to
   expose backend capabilities to AI hosts without duplicating business logic between
   your REST API and your MCP tools.
3. **Reuse existing service-layer functions inside MCP tool definitions** — the tool
   function should be a thin wrapper, not a reimplementation.
4. **When streaming MCP-backed agent responses to a frontend**, translate tool
   calls into the same structured SSE event schema you'd use for any agentic UI (see
   `react-ai-architect`'s `agentic_ui_patterns.md`).