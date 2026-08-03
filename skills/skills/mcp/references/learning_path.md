# Beginner → Advanced Learning Path (MCP)

Use this as a curriculum when the user wants a structured roadmap rather than a
point answer. Each phase names the reference file(s) to pull detail from.

## Phase 0 — Orientation (15 minutes)

- Understand the "USB-C for AI" framing and why MCP exists — one server, many hosts,
  instead of N custom integrations. See `SKILL.md`.
- Understand the four roles (host/client/server/transport) and the three primitives
  (tools/resources/prompts) at a high level.
- Install `uv` and `mcp[cli]`; run the 5-line quickstart from `SKILL.md`.

**Practice:** Get the minimal `add`/`greeting` FastMCP server running locally and
connect the MCP Inspector to it.

## Phase 1 — Architecture Fundamentals

*Read: `architecture.md`*

1. Understand host vs. client vs. server precisely — these terms mean something
   specific in MCP, distinct from general networking usage.
2. Understand the connection lifecycle: initialize → capability negotiation → active
   session → shutdown.
3. Understand why capability negotiation matters (not every client/server supports
   every optional feature).

**Practice:** Use the MCP Inspector to watch the raw JSON-RPC `initialize` exchange
for your Phase 0 server — identify the capabilities each side declares.

## Phase 2 — Tools, Resources, and Prompts

*Read: `tools_resources_prompts.md`*

1. Build a tool with a well-written docstring and typed parameters.
2. Build a static resource, then a dynamic (templated URI) resource.
3. Build a prompt that encodes a multi-step strategic plan for using your server's
   tools together.
4. Practice the "who decides to invoke it" judgment call on 3-4 hypothetical
   features of your choice.

**Practice project:** Build a small "notes" server — a tool to add a note, a
resource exposing all notes as read-only content, and a prompt template for
"summarize my notes on topic X."

## Phase 3 — Building Servers Properly

*Read: `building_servers.md`*

1. Add a `Context` parameter to a tool and use `ctx.report_progress`.
2. Add proper error handling with `ToolError` and a timeout on an external call.
3. Split a growing server into a `tools/` module structure.
4. Write a pytest test using the in-memory transport.

**Practice project:** Extend your notes server with a tool that fetches from a slow
external API (simulate with `asyncio.sleep`), complete with a timeout and progress
reporting.

## Phase 4 — Transports & Deployment Topology

*Read: `transports.md`*

1. Run your server with stdio (default) and understand why logging to stdout would
   break it.
2. Switch to Streamable HTTP and connect the Inspector to the HTTP endpoint instead.
3. Mount your server into a FastAPI app alongside a normal REST route.

**Practice project:** Deploy your notes server as a Streamable HTTP endpoint mounted
inside a small FastAPI app, verifiable via both `curl` (for the REST routes) and the
MCP Inspector (for the MCP endpoint).

## Phase 5 — Connecting to Real Hosts

*Read: `host_integration.md`*

1. Configure Claude Desktop or Claude Code to connect to your local stdio server.
2. Verify tool-calling works end-to-end in a real conversation.
3. If you built resources, verify `@`-mention access works.

**Practice project:** Get your notes server working inside Claude Desktop or Claude
Code for real — ask Claude to add a note and then summarize your notes using your
custom prompt template.

## Phase 6 — Advanced Features

*Read: `advanced_features.md`*

1. Add elicitation to a tool that needs missing required input.
2. If your host supports it, try sampling — a tool that asks the connected LLM to
   summarize something mid-execution.
3. Add a resource-list-changed notification when your notes collection updates.

**Practice project:** Add elicitation to your "add note" tool — if the user doesn't
specify a category, have the server ask for one via a form dialog.

## Phase 7 — Security

*Read: `security.md`*

1. Review the GitHub MCP server prompt-injection incident and understand exactly
   why the broad token made it worse.
2. Apply the least-privilege credential principle to any external API your server
   calls.
3. Add input validation to any tool that touches the filesystem or an external
   system.
4. If deploying remotely, understand what OAuth 2.1 support would require.

**Practice project:** Audit your notes server against the security checklist —
identify (even if hypothetically) what an attacker could do if a note's content
itself contained injected instructions, and add a defensive system-prompt-level
mitigation.

## Phase 8 — Framework Integration

*Read: `framework_integration.md`*

1. Connect your server to a LangChain agent via `langchain-mcp-adapters`.
2. If you have a FastAPI backend from other projects, mount an MCP server into it
   reusing existing service functions.
3. Try Claude's native `mcp_servers` API parameter against a Streamable HTTP
   deployment of your server for the simplest possible integration.

**Practice project:** Wire your notes server into a LangChain `create_agent` and
have a short conversation where the agent both adds and retrieves notes via your
MCP tools.

## Phase 9 — Ecosystem Awareness

*Read: `ecosystem_and_a2a.md`*

1. Browse the official servers list and the MCP Registry — get a feel for what
   already exists before ever building something from scratch again.
2. Understand the MCP/A2A distinction at a conceptual level, even without building
   an A2A integration.

**Practice:** Find an existing MCP server for a tool/service you use regularly and
connect it to Claude Desktop or Claude Code — experience the "write once, use
everywhere" value proposition directly as a consumer, not just a builder.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer with a
specific production task):
- Go phase by phase, building one cumulative "notes server" project rather than
  disconnected examples — it becomes progressively more capable through the phases.
- Emphasize Phase 7 (security) even for a toy project — the habits matter more than
  the specific server, and MCP's security model is genuinely different from typical
  web API security in ways worth internalizing early.
- Check understanding with a quick build before advancing — e.g., "before adding
  Streamable HTTP, want to try watching the Inspector's JSON-RPC traffic for your
  stdio server first?"
- Flag clearly when something is a production/enterprise concern (OAuth gateways,
  MCP Registry publishing) vs. something worth practicing immediately on a local
  toy server.