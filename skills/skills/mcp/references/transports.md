# Transports — stdio, Streamable HTTP, and (Legacy) SSE

## The two current standard transports

| Transport | How it works | Best for | Network exposure |
|---|---|---|---|
| **stdio** | Client launches the server as a local subprocess, communicates via stdin/stdout | Local tools, desktop integrations (Claude Desktop, Claude Code), CLI tools, development | None — same machine only |
| **Streamable HTTP** | HTTP POST for client→server messages, with optional SSE for server→client streaming | Remote/shared servers, production deployments, multi-client scenarios | Network-accessible, supports standard HTTP auth (bearer tokens, API keys) |

Both carry the same JSON-RPC 2.0 messages — the choice is purely about deployment
topology, not protocol capability.

## stdio transport — local subprocess communication

```python
if __name__ == "__main__":
    mcp.run()  # defaults to stdio
```

The host (e.g. Claude Desktop) spawns your server as a child process and
communicates by writing to its stdin and reading its stdout. This is:
- **Fast** — no network overhead, direct process-to-process communication.
- **Secure by default** — no open network port, no exposure beyond the local machine.
- **The transport used by virtually every local dev tool integration** (filesystem
  servers, local database servers, CLI-wrapping servers).

**Critical implementation detail: never write logs to stdout.** stdout is reserved
exclusively for JSON-RPC protocol messages — any stray `print()` statement corrupts
the message stream and breaks the connection. Log to stderr instead:

```python
import sys
print("Server starting...", file=sys.stderr)  # correct
# print("Server starting...")                  # WRONG — corrupts stdio transport
```

FastMCP's built-in logging is already configured to use stderr — this only matters
if you add your own ad-hoc print statements or third-party libraries that log to
stdout by default.

### stdio client configuration (what Claude Desktop reads)

```json
{
  "mcpServers": {
    "weather": {
      "command": "uv",
      "args": ["--directory", "/ABSOLUTE/PATH/TO/weather-server", "run", "weather.py"]
    }
  }
}
```

Always use **absolute paths** — relative paths resolve against an unpredictable
working directory when the host spawns the subprocess. See `host_integration.md` for
the full configuration walkthrough.

## Streamable HTTP transport — remote, multi-client

```python
if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

By default this starts a server listening on `http://127.0.0.1:8000/mcp` (host/port
configurable). Streamable HTTP:
- Uses HTTP POST for client-to-server messages.
- Optionally uses Server-Sent Events for server-to-client streaming within a request.
- Supports standard HTTP authentication (bearer tokens, API keys, custom headers) —
  see `security.md` for OAuth 2.1 specifics.
- Can serve **many clients simultaneously**, unlike stdio's effectively single-client
  model.

```bash
# Test with the MCP Inspector against a running Streamable HTTP server
mcp dev server.py
# then connect the Inspector UI to http://localhost:8000/mcp
```

## Legacy: HTTP+SSE transport

An earlier remote transport (separate `GET /sse` for the event stream and
`POST /messages` for client messages) that predates Streamable HTTP. It still
appears in older tutorials and some existing deployments:

```python
# Legacy pattern — prefer Streamable HTTP for new servers
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette

sse = SseServerTransport("/messages")
# ... wire into a Starlette app with a GET /sse and POST /messages route
```

**Streamable HTTP is the current recommended remote transport** — it consolidates
what HTTP+SSE needed two separate endpoints for into a single, simpler transport
with better connection resumability. Only reach for the legacy SSE transport when
maintaining an existing deployment or interoperating with an older client that
hasn't upgraded.

## Mounting an MCP server inside an existing ASGI app (e.g. FastAPI)

```python
from fastapi import FastAPI
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("MyServer")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

app = FastAPI()
app.mount("/mcp-server", mcp.streamable_http_app())
```

This lets you run your MCP server as part of the same FastAPI process serving your
regular REST API — useful when you already have a FastAPI backend and want to expose
some of its capabilities as MCP tools without standing up a separate service. See
`framework_integration.md` for the fuller pattern.

## Choosing a transport for your deployment

| Scenario | Transport |
|---|---|
| A tool for your own local Claude Desktop/Claude Code setup | stdio |
| A CLI-based dev tool wrapper | stdio |
| A server your whole team/organization should be able to connect to | Streamable HTTP |
| A server exposed publicly (e.g. a SaaS product's official MCP server) | Streamable HTTP, with OAuth |
| You're extending an existing FastAPI backend | Streamable HTTP, mounted into the same ASGI app |

## Custom transports

MCP's transport layer is explicitly designed to be extensible — the protocol works
"over stdio, HTTP, WebSockets, etc." Custom transports are rarely needed (Streamable
HTTP covers the overwhelming majority of remote use cases), but the low-level SDK
exposes the interfaces needed to implement one if you have a genuinely unusual
deployment constraint (e.g. a proprietary internal RPC layer).

## Practical guidance

1. **stdio for local, Streamable HTTP for remote/shared** — this single rule covers
   the large majority of transport decisions.
2. **Never print to stdout in a stdio server** — log to stderr exclusively, or use
   FastMCP's built-in logging which already does this correctly.
3. **Prefer Streamable HTTP over legacy SSE** for any new remote server.
4. **Mount MCP directly into an existing FastAPI app** (`app.mount(...)`) when you
   want to expose backend capabilities as MCP tools without a separate service.
5. **Always use absolute paths** in stdio client configuration files.