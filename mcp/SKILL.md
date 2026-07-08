---
name: mcp-architect
description: >
  Complete architect's manual for the Model Context Protocol (MCP), the open standard
  from Anthropic (now under the Linux Foundation's Agentic AI Foundation) for
  connecting AI applications to external tools, data, and services. Use whenever the
  user asks about MCP, building an MCP server or client, exposing tools/resources/
  prompts to Claude or other AI hosts, connecting Claude Desktop or Claude Code to
  custom data sources, the FastMCP framework, MCP transports (stdio, Streamable HTTP,
  SSE), MCP authentication/OAuth, MCP security (prompt injection, tool poisoning),
  sampling, elicitation, or integrating MCP with LangChain, agent frameworks, or a
  FastAPI backend. Also trigger for beginner questions like what MCP is, why it
  matters, how it compares to a regular REST API, or which MCP servers already exist
  for a given tool (GitHub, Slack, Postgres, etc.). Trigger even if the user uses
  older terminology or asks how MCP relates to function calling, tool use, or A2A.
---

# The MCP (Model Context Protocol) Architect's Manual

You are acting as an expert MCP architect. MCP is an open-source standard,
introduced by Anthropic in November 2024 and now co-stewarded under the Linux
Foundation's **Agentic AI Foundation** (alongside Block and OpenAI), for connecting
AI applications to external tools, data sources, and workflows — **without writing a
custom integration for every combination of AI app and tool.**

**Docs home:** `modelcontextprotocol.io/docs` · **Spec:** `spec.modelcontextprotocol.io`
**Python SDK:** `py.sdk.modelcontextprotocol.io` · **FastMCP:** `gofastmcp.com`

## The one-line mental model

> **MCP is a USB-C port for AI.** Any MCP-compliant host (Claude, ChatGPT, Cursor, VS
> Code) can plug into any MCP-compliant server and immediately discover and use its
> tools, data, and prompts — write the integration once, and every current and future
> MCP host can use it.

Before MCP, connecting an LLM to N data sources meant N bespoke, non-reusable
integrations. With MCP, you write one server per data source/tool, and it works with
every MCP-compatible client — Claude Desktop, Claude Code, Cursor, VS Code Copilot,
ChatGPT, ships. **MCP does not replace REST/GraphQL APIs** — it's a standardized layer
*on top of* your existing APIs/databases/services, specifically for LLM discovery and
invocation.

## The four architectural roles

| Role | What it is | Example |
|---|---|---|
| **Host** | The AI application the user interacts with; coordinates one or more clients | Claude Desktop, Claude Code, Cursor, VS Code |
| **Client** | Lives inside the host; maintains a **1:1 stateful connection** to exactly one server | Instantiated automatically by the host per connected server |
| **Server** | A program exposing tools/resources/prompts via MCP | A weather server, a Postgres server, your company's internal API wrapped in MCP |
| **Transport** | The communication channel carrying JSON-RPC 2.0 messages between client and server | stdio (local) or Streamable HTTP (remote) |

A single host can run many clients simultaneously (one per connected server) — this
is why Claude Desktop can talk to your filesystem, GitHub, and a database server all
in the same conversation, each through its own isolated client-server pair.

## The three core primitives servers expose

| Primitive | Analogy | Read/write | Who decides to invoke it |
|---|---|---|---|
| **Tools** | POST endpoints | Executes actions, has side effects | The **model** decides to call them (with user approval) |
| **Resources** | GET endpoints | Read-only data the LLM can load into context | The **client/user** decides to attach them (e.g. `@` mentions) |
| **Prompts** | Reusable templates / slash commands | Guided interaction templates | The **user** explicitly selects them |

Getting this distinction right is the single most important design decision when
building a server — see `references/tools_resources_prompts.md`.

## Quick-start: a minimal server with FastMCP

```bash
uv add "mcp[cli]"
```

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Demo")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """Get a personalized greeting"""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

```bash
# Debug with the official MCP Inspector
mcp dev server.py
```

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Architecture deep dive: host/client/server, JSON-RPC, lifecycle, capability negotiation | `references/architecture.md` |
| Tools, Resources, and Prompts in depth — when to use which, annotations, dynamic content | `references/tools_resources_prompts.md` |
| Building servers with FastMCP: full walkthrough, structured output, error handling, Context object | `references/building_servers.md` |
| Transports: stdio vs Streamable HTTP vs (legacy) SSE, ASGI mounting, choosing for your deployment | `references/transports.md` |
| Building MCP clients: Python client SDK, connecting to servers programmatically, host integration | `references/building_clients.md` |
| Advanced server features: sampling (server asks the LLM for help), elicitation (server asks the user), progress, logging, completions | `references/advanced_features.md` |
| Security: prompt injection, tool poisoning, real CVEs, authentication/OAuth 2.1, sandboxing | `references/security.md` |
| Connecting MCP to Claude Desktop, Claude Code, and other hosts; config file format | `references/host_integration.md` |
| Integrating MCP with LangChain, LangGraph, and your own FastAPI backend | `references/framework_integration.md` |
| The broader ecosystem: existing servers, MCP Registry, A2A protocol, where MCP is heading | `references/ecosystem_and_a2a.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Tools vs. Resources vs. Prompts — pick based on who decides, not just data
   shape.** If the *model* should decide when to invoke it and it has side effects →
   Tool. If it's read-only context the *user/client* attaches → Resource. If it's a
   *user-selected* interaction template → Prompt.
2. **Default to FastMCP, not the low-level SDK**, unless you need custom transports
   or protocol features FastMCP hasn't wrapped — FastMCP's decorator-based API
   (`@mcp.tool()`, `@mcp.resource()`, `@mcp.prompt()`) eliminates nearly all JSON-RPC
   boilerplate.
3. **Keep tool count focused** — median production servers expose around 5 tools;
   too many tools makes it harder for the model to select the right one. Prefer a
   few well-designed, clearly-described tools over exposing every internal function.
4. **Never write secrets into server code** — inject API keys and credentials via
   environment variables, always.
5. **Start read-only.** When building a server against a sensitive system, expose
   only query/read tools first; add write/update/delete tools only after observing
   stable model behavior.
6. **Treat all external content flowing through a tool/resource as untrusted input**
   — prompt injection via tool results (a malicious GitHub issue, a poisoned web page)
   is the field's most serious unsolved security problem. See `references/security.md`
   before connecting any server to content you don't fully control.
7. **Use Streamable HTTP for anything remote/shared; stdio for local, single-user
   tools.** stdio has no network exposure by design — the right default for local dev
   tools; Streamable HTTP is required for anything served to multiple users/hosts.
8. **Source of truth:** `modelcontextprotocol.io`. This protocol moves fast — spec
   revisions ship roughly every few months, and both the Python SDK and FastMCP have
   had major version jumps within a single year. Web-search for anything
   version-specific rather than assuming an older pattern still applies.