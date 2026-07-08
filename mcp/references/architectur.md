# Architecture — Host, Client, Server, JSON-RPC, Lifecycle

## The layered architecture

MCP separates concerns into two layers:

- **Data layer** (inner): a JSON-RPC 2.0-based protocol defining message structure,
  lifecycle management, and the core primitives (tools, resources, prompts,
  notifications).
- **Transport layer** (outer): defines *how* those JSON-RPC messages actually move
  between client and server — connection establishment, message framing, and
  authorization.

Think of the data layer as "what gets said" and the transport layer as "how it
physically gets there" — the same JSON-RPC messages work identically whether carried
over stdio or Streamable HTTP.

## The four participants

```
┌─────────────────────────────────────────┐
│  HOST (e.g. Claude Desktop, Claude Code) │
│                                           │
│   ┌─────────┐        ┌─────────┐         │
│   │ Client A│        │ Client B│         │
│   └────┬────┘        └────┬────┘         │
└────────┼──────────────────┼──────────────┘
         │ 1:1              │ 1:1
         ▼                  ▼
   ┌───────────┐      ┌───────────┐
   │ Server A  │      │ Server B  │
   │(GitHub)   │      │(Postgres) │
   └───────────┘      └───────────┘
```

- **Host** — the AI application the user directly interacts with (Claude Desktop,
  Claude Code, Cursor, VS Code, ChatGPT). The host coordinates multiple clients,
  and is responsible for access control and data governance — **MCP itself does not
  automatically secure anything**; the host decides what to allow.
- **Client** — instantiated by the host, one per connected server, maintaining a
  dedicated, stateful 1:1 connection. The client converts host/user/model requests
  into MCP protocol messages and routes responses back.
- **Server** — a program that provides tools, resources, and prompts to clients.
  Servers can run **locally** (same machine, via stdio — e.g. a filesystem server
  launched as a subprocess) or **remotely** (over the network, via Streamable HTTP —
  e.g. a hosted Sentry or Postgres server).
- **Transport** — the JSON-RPC-carrying channel (see `transports.md` for the full
  comparison).

**Important terminology note:** "server" in MCP refers to the *program providing
context*, regardless of where it physically runs — a common point of confusion since
"server" in everyday usage implies "runs remotely," which isn't required here.

## JSON-RPC 2.0 — the wire format

Every MCP message is one of three types, all JSON-RPC 2.0:

```json
// Request — expects a response
{ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": "add", "arguments": {"a": 1, "b": 2} } }

// Response — success
{ "jsonrpc": "2.0", "id": 1, "result": { "content": [{"type": "text", "text": "3"}] } }

// Response — error
{ "jsonrpc": "2.0", "id": 1, "error": { "code": -32602, "message": "Invalid params" } }

// Notification — one-way, no response expected (no "id")
{ "jsonrpc": "2.0", "method": "notifications/tools/list_changed" }
```

You will almost never hand-write these — FastMCP and the SDKs handle serialization
entirely — but understanding the shape matters for debugging (the MCP Inspector shows
raw JSON-RPC traffic) and for anyone building a custom/low-level transport.

## Connection lifecycle

```
Host → Client: Initialize client
Client → Server: initialize (declares client capabilities)
Server → Client: responds with supported capabilities
        [capability negotiation complete — session is now "active"]

loop  Client-initiated requests (tools/call, resources/read, prompts/get)
loop  Server-initiated requests (sampling/createMessage, elicitation)
loop  Notifications (resource updates, list changes, progress) — either direction

Host → Client: Terminate
Client → Server: End session (transport closes)
```

1. **Initialization** — client and server exchange protocol versions and declare
   **capabilities** (which primitives/features each side supports). This negotiation
   happens once per session; subsequent calls don't repeat it, keeping later JSON-RPC
   exchanges compact.
2. **Active session** — the negotiated feature set is now fixed for the session.
   Client requests (`tools/call`, `resources/read`, `prompts/get`) and, if the client
   declared support, server-initiated requests (`sampling/createMessage`,
   `elicitation/create`) can flow in either direction, plus asynchronous
   notifications (e.g. `notifications/resources/updated`) for real-time updates.
3. **Shutdown** — no explicit MCP shutdown message is required; the underlying
   transport simply closes (stdin closes for stdio, the HTTP connection drops for
   Streamable HTTP). Servers should use lifecycle/lifespan hooks to clean up
   resources on this event.

## Capability negotiation

MCP uses **capability-based negotiation** — nothing is assumed to be supported by
default. During `initialize`:

- The **server** declares which primitives it supports (tools, resources, prompts,
  and whether it supports dynamic list-change notifications for each).
- The **client** declares which features it supports on its side (e.g., sampling
  support, notification handling, elicitation support).
- **Both parties must respect declared capabilities for the rest of the session** —
  e.g., a server can't attempt sampling if the client didn't declare sampling
  support during negotiation.

This is why, for example, `sampling/createMessage` (a server asking the connected
LLM for help — see `advanced_features.md`) only works if the client explicitly
opted into that capability; not every MCP client implements every optional feature.

## Why this design, briefly

- **1:1 client-server mapping** gives each connection isolated state and security
  boundaries — one compromised or misbehaving server can't directly see another
  server's traffic.
- **Transport-agnostic data layer** means the same tool/resource/prompt definitions
  work whether the server runs as a local subprocess or a remote HTTPS service — you
  write the capability once.
- **Persistent, stateful sessions** (rather than isolated request/response like plain
  REST) let servers push real-time notifications (a file changed, a new tool became
  available) instead of forcing clients to poll.

## Practical guidance

1. **Think in terms of the four roles explicitly** when designing a system — "host"
   and "client" are not interchangeable terms with "server," and getting this
   vocabulary right avoids confusion when reading the spec or SDK docs.
2. **Remember the host owns access control** — MCP's protocol design doesn't
   automatically secure anything; that responsibility sits with whoever builds or
   configures the host application.
3. **You rarely touch raw JSON-RPC directly** — but understanding the lifecycle
   (initialize → active session → shutdown) is essential for debugging connection
   issues, and the MCP Inspector is the standard tool for watching this traffic live.