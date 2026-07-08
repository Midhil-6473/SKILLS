# Building Servers — FastMCP Deep Dive

## FastMCP vs. the low-level SDK

```
FastMCP           →  decorator-based, ~5x less boilerplate, the default choice
Low-level SDK     →  direct JSON-RPC handler registration, needed only for
                      custom transports or protocol features FastMCP hasn't wrapped
```

FastMCP ships as part of the official `mcp` Python package (`mcp.server.fastmcp`),
and also as a more actively-developed standalone package (`fastmcp` on PyPI, from the
Prefect team, currently at v3.x) with additional features (component versioning,
authorization controls, OpenTelemetry, multiple provider types). Both use the same
core decorator API — start with whichever is already installed via `mcp[cli]`; reach
for the standalone `fastmcp` package specifically for its extra production features.

## Project setup

```bash
uv init my-mcp-server
cd my-mcp-server
uv add "mcp[cli]"
```

```python
# server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("MyServer")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

if __name__ == "__main__":
    mcp.run()  # defaults to stdio transport
```

```bash
uv run server.py                 # run directly
uv run mcp dev server.py         # run + launch MCP Inspector for debugging
```

## The `Context` object — accessing session capabilities from a tool

```python
from mcp.server.fastmcp import FastMCP, Context

mcp = FastMCP("DataServer")

@mcp.tool()
async def process_large_dataset(file_path: str, ctx: Context) -> str:
    """Process a large dataset with progress reporting."""
    total_rows = count_rows(file_path)
    for i, row in enumerate(read_rows(file_path)):
        process_row(row)
        if i % 100 == 0:
            await ctx.report_progress(i, total_rows)  # streams progress to the client
    await ctx.info(f"Processed {total_rows} rows")     # logs to the client
    return f"Processed {total_rows} rows successfully"
```

Add a `Context` parameter to any tool function and FastMCP injects it automatically —
this is how a tool reports progress, logs messages back to the client, requests
sampling from the connected LLM, or triggers elicitation (see
`advanced_features.md`) — all without the tool needing to know anything about the
underlying transport.

## Error handling

```python
from mcp.server.fastmcp.exceptions import ToolError

@mcp.tool()
def divide(a: float, b: float) -> float:
    """Divide a by b."""
    if b == 0:
        raise ToolError("Cannot divide by zero")
    return a / b
```

Raising `ToolError` (or letting FastMCP catch an unhandled exception) returns a
structured error the model can reason about and potentially retry or explain to the
user — never let a tool silently swallow an error and return a misleading success
result.

### Returning structured errors from data-fetching tools

```python
@mcp.tool()
def fetch_order(order_id: str) -> dict:
    """Fetch order details by ID."""
    order = db.get_order(order_id)
    if order is None:
        return {"error": "ORDER_NOT_FOUND", "message": f"No order with id {order_id}"}
    return order.to_dict()
```

For expected "not found"/"rate limited" cases (as opposed to genuine server bugs),
returning a structured error payload the model can read and explain to the user is
often better UX than raising an exception that terminates the tool call abruptly.

## Timeouts — protecting against slow external calls

```python
@mcp.tool(timeout=10.0)  # seconds
def call_slow_external_api(query: str) -> str:
    """Query an external service that may be slow."""
    return external_api.search(query)
```

**Every tool calling an external API or database should have a timeout.** Without
one, a single slow third-party dependency can block the entire server — a real
production risk, not a theoretical one.

## Sync vs. async tool functions

```python
@mcp.tool()
def cpu_bound_task(data: str) -> str:      # sync — dispatched to a thread pool by default
    return heavy_computation(data)

@mcp.tool()
async def io_bound_task(url: str) -> str:  # async — runs directly on the event loop
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.text
```

Sync tool functions are automatically dispatched to a thread pool so they don't
block FastMCP's event loop — this is the correct default. Set
`@mcp.tool(run_in_threadpool=False)` only for libraries with thread affinity
(certain GPU/driver bindings, `tkinter`, Windows COM) that must run on the main
thread.

## Server instructions — a "user manual" for the whole server

```python
mcp = FastMCP(
    "DatabaseServer",
    instructions="""
    This server provides read-only access to the analytics database.
    Always use search_tables before query_table to confirm the table exists.
    Query results are limited to 1000 rows; use pagination for larger result sets.
    """,
)
```

Server-level `instructions` are shown to the model once per session (not per-tool)
and are the right place for cross-cutting guidance — recommended tool sequencing,
rate limits, or conventions that don't belong in any single tool's docstring.

## Structuring a larger server

```
my-mcp-server/
├── server.py           # FastMCP instance, mcp.run()
├── tools/
│   ├── search.py        # tool implementations, imported and registered in server.py
│   └── database.py
├── resources/
│   └── schema.py
└── pyproject.toml
```

```python
# tools/database.py
def register_database_tools(mcp: FastMCP):
    @mcp.tool()
    def query_table(table: str, limit: int = 100) -> list[dict]:
        """Query rows from a table, read-only."""
        return db.query(table, limit=limit)

# server.py
from tools.database import register_database_tools
mcp = FastMCP("MyServer")
register_database_tools(mcp)
```

For anything beyond a handful of tools, split registration into modules — keeps
`server.py` as a thin composition root rather than a monolithic file.

## Testing with pytest and in-memory transport

```python
import pytest
from mcp.shared.memory import create_connected_server_and_client_session

@pytest.mark.asyncio
async def test_add_tool():
    async with create_connected_server_and_client_session(mcp._mcp_server) as client:
        result = await client.call_tool("add", {"a": 2, "b": 3})
        assert result.structured_content == {"result": 5}
```

The in-memory transport lets you test tool behavior end-to-end (through the actual
MCP protocol layer, not just calling the underlying Python function directly)
without spawning a subprocess or opening a network port.

## Lifespan management — setup/teardown

```python
from contextlib import asynccontextmanager
from mcp.server.fastmcp import FastMCP

@asynccontextmanager
async def lifespan(server: FastMCP):
    db_pool = await create_db_pool()
    yield {"db_pool": db_pool}
    await db_pool.close()

mcp = FastMCP("DatabaseServer", lifespan=lifespan)

@mcp.tool()
def query(sql: str, ctx: Context) -> list[dict]:
    """Run a read-only query."""
    pool = ctx.request_context.lifespan_context["db_pool"]
    return pool.execute(sql)
```

Use lifespan for any resource (DB connection pool, HTTP client session) that should
be created once at server startup and cleanly torn down at shutdown — the same
principle as FastAPI's `lifespan` pattern.

## Practical guidance

1. **Default to FastMCP's decorator API** — drop to the low-level SDK only for
   genuinely custom transport/protocol needs.
2. **Add a `Context` parameter whenever a tool needs to report progress, log, or is
   long-running** — this is the mechanism for all of that, injected automatically.
3. **Always set timeouts on tools calling external services.**
4. **Use `ToolError` (or structured error dicts) rather than letting exceptions
   propagate unhandled** — the model needs to be able to reason about failures.
5. **Use server-level `instructions` for cross-cutting guidance**, not repeated in
   every tool docstring.
6. **Test with the in-memory transport** rather than spawning real subprocesses for
   unit tests — faster and avoids transport-layer flakiness in CI.