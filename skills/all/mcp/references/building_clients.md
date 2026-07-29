# Building MCP Clients

## When you'd build a client vs. use an existing host

Most developers only ever build **servers** — Claude Desktop, Claude Code, Cursor,
and other existing hosts already provide production-quality clients. Build your own
client when:
- You're building a **custom AI application/agent** that needs to consume MCP
  servers programmatically (e.g., your own FastAPI-based agent backend).
- You want to **test a server** you're developing, outside the MCP Inspector.
- You're building a **new host application** from scratch.

## Minimal client — connecting to a server programmatically

```python
import asyncio
from mcp import Client
from server import mcp  # your FastMCP server instance, for in-process testing

async def main():
    async with Client(mcp) as client:
        result = await client.call_tool("add", {"a": 1, "b": 2})
        print(result.structured_content)  # {'result': 3}

asyncio.run(main())
```

The same client code works against a **remote** server by swapping the target:

```python
async with Client("http://localhost:8000/mcp") as client:
    result = await client.call_tool("add", {"a": 1, "b": 2})
```

This is one of MCP's most useful properties for development: **write your client
logic once, test it in-process against your server module during development, then
point it at a deployed URL for production** — no code changes needed.

## Connecting via stdio (launching a server subprocess)

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

server_params = StdioServerParameters(
    command="uv",
    args=["--directory", "/path/to/weather-server", "run", "weather.py"],
)

async def main():
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print([t.name for t in tools.tools])

            result = await session.call_tool("get_forecast", {"city": "Boston"})
            print(result.content)

asyncio.run(main())
```

**Security default worth knowing:** the stdio client only passes a minimal, safe set
of environment variables to the spawned subprocess by default (not the full parent
environment) — this avoids inheriting potentially dangerous shell functions or
unintended secrets. If your server genuinely needs specific environment variables,
pass them explicitly via the `env` parameter rather than relying on inheritance.

```python
server_params = StdioServerParameters(
    command="uv", args=["run", "server.py"],
    env={"API_KEY": os.environ["API_KEY"]},  # explicit, not inherited
)
```

## Listing and calling tools, resources, and prompts

```python
async with ClientSession(read, write) as session:
    await session.initialize()

    # Tools
    tools = await session.list_tools()
    result = await session.call_tool("search", {"query": "MCP architecture"})

    # Resources
    resources = await session.list_resources()
    content = await session.read_resource("config://app-settings")

    # Prompts
    prompts = await session.list_prompts()
    prompt_result = await session.get_prompt("greet_user", {"name": "Alice", "style": "formal"})
```

## Handling server-initiated requests (sampling, elicitation)

If your client declares support for these capabilities during initialization, the
server can call back into your client mid-tool-execution:

```python
from mcp import ClientSession
from mcp.types import CreateMessageRequestParams, CreateMessageResult

async def handle_sampling(params: CreateMessageRequestParams) -> CreateMessageResult:
    # Forward the server's request to your actual LLM
    response = await your_llm_client.complete(params.messages)
    return CreateMessageResult(role="assistant", content={"type": "text", "text": response})

session = ClientSession(read, write, sampling_callback=handle_sampling)
```

This is the mechanism behind `sampling/createMessage` (see `advanced_features.md`) —
your client acts as the bridge between the server's request and whatever LLM your
application actually has access to.

## Integrating an MCP client into a FastAPI agent backend

```python
from fastapi import FastAPI
from mcp import Client

app = FastAPI()
mcp_clients: dict[str, Client] = {}

@app.on_event("startup")
async def connect_mcp_servers():
    mcp_clients["filesystem"] = Client("http://localhost:8001/mcp")
    await mcp_clients["filesystem"].__aenter__()

@app.post("/api/agent/run")
async def run_agent(request: AgentRequest):
    tools = await mcp_clients["filesystem"].list_tools()
    # Convert MCP tool schemas into your LLM provider's tool-calling format,
    # run your agent loop, dispatching tool calls back through mcp_clients[...] .call_tool(...)
    ...
```

This is the pattern for connecting your own FastAPI-based agent (see the
`react-ai-architect` skill's `fastapi_llm_gateway.md` for the surrounding agent-loop
context) to MCP servers as its tool source, rather than hand-defining tools inline.

## Using Anthropic's built-in MCP connector (no client code needed)

For **remote** servers accessible by URL, Claude's Messages API can connect directly
without you writing any MCP client code at all:

```python
import anthropic

client = anthropic.Anthropic()
response = client.beta.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "What's blocking the release in Jira?"}],
    mcp_servers=[{
        "type": "url",
        "url": "https://your-mcp-server.com/mcp",
        "name": "jira",
    }],
    extra_headers={"anthropic-beta": "mcp-client-2025-04-04"},
)
```

Use this when you have a remote server and only need **tool support** (not
resources/prompts, and not local stdio servers) — it eliminates writing and
maintaining a separate MCP client entirely. Use the SDK-based client approach above
when you need local servers, resources, prompts, or finer control over the
connection.

## Practical guidance

1. **Use Anthropic's built-in MCP connector for the simple case** (remote server,
   tools only) before reaching for a full client implementation.
2. **Write client logic once against an in-process server, then swap in a URL for
   production** — this dramatically speeds up development iteration.
3. **Never rely on environment inheritance for stdio server secrets** — pass them
   explicitly via the `env` parameter.
4. **Implement a `sampling_callback`** only if your server genuinely needs
   server-initiated LLM calls — most simple tool-calling servers don't need this.