# Security — Prompt Injection, Tool Poisoning, Real CVEs, Authentication

## The core threat model

**MCP servers execute code on your machine (or with your credentials) based on what
an LLM decides to do.** If an attacker can influence what the LLM sees — through a
tool result, a resource's content, or even a tool's own description — they can
potentially influence what your server does next. This is **the number one unsolved
security problem in the MCP ecosystem**, not a theoretical concern.

## Prompt injection via tool/resource content — the real-world case

In a widely-cited 2025 incident, security researchers at Invariant Labs demonstrated
an attack against the **official GitHub MCP server**: they created a malicious GitHub
issue whose text, when read by an AI agent, hijacked the agent into leaking private
repository data (including salary information) into a public pull request. The root
cause combined an overly broad Personal Access Token with untrusted external content
(the issue text) landing directly in the LLM's context window and being followed as
if it were a trusted instruction.

**This was not a contrived lab demo — it used the official, widely-installed GitHub
MCP server.** The lesson generalizes: **any tool or resource that surfaces
externally-controlled content (issues, PRs, web pages, emails, uploaded files) is a
prompt injection vector**, regardless of how reputable the server's source is.

## Documented vulnerabilities (know these exist)

| Issue | What happened |
|---|---|
| **CVE-2025-6514** | A critical command-injection bug in `mcp-remote`, a popular OAuth proxy with hundreds of thousands of downloads |
| **CVE-2025-6515** | Session hijacking in `oatpp-mcp` via predictable session IDs, allowing prompt injection into other users' sessions |
| **MCP Inspector RCE** | Anthropic's own official debugging tool had an unauthenticated remote-code-execution vulnerability — inspecting a malicious server could give the attacker a shell |
| **Broad ecosystem findings** | Independent security assessments have found command injection in a substantial fraction of tested community MCP server implementations, and a meaningful share vulnerable to server-side request forgery (SSRF) |

The takeaway isn't "avoid MCP" — it's that **MCP servers deserve the same security
rigor as any other code executing with real credentials against real systems**, and
the ecosystem's youth means many existing community servers haven't had that rigor
applied yet.

## Defense-in-depth checklist for anyone building or deploying a server

### 1. Least-privilege credentials
```python
# Bad: a broad, unscoped token with full repo access
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]  # if this token can do everything, so can a hijacked agent

# Better: scope the token to exactly what the server's tools need
# (read-only issues access, no write access to other repos, etc.)
```
The GitHub incident above was made materially worse by an overly broad token. Scope
every credential a server uses to the minimum required for its actual tool set.

### 2. Never mount broad filesystem/network access
```bash
# Bad
docker run -v /:/app/host mcp-server              # never mount root
docker run -v $HOME:/app/home mcp-server            # never mount the full home directory

# Good — mount only the specific directory the server actually needs
docker run -v $(pwd)/projects:/app/projects mcp-server
```

### 3. Validate and sanitize tool inputs defensively
```python
@mcp.tool()
def scaffold_project(name: str, language: str) -> str:
    """Create a new project directory."""
    if language not in ALLOWED_LANGUAGES:
        raise ToolError(f"Unsupported language: {language}")
    safe_path = PROJECTS_DIR / sanitize_filename(name)
    if safe_path.exists():
        raise ToolError("A project with this name already exists")
    # ... proceed only with validated input
```
Treat every tool argument as untrusted, even though it nominally comes from "the
model" — since the model's arguments can themselves be influenced by injected content
the model read from an untrusted source.

### 4. Start read-only; add write/destructive tools deliberately
As covered in `SKILL.md`: expose only query/read tools first when connecting to a
sensitive system. Add write, update, or delete tools only after observing stable
model behavior over time — this staged rollout meaningfully limits blast radius.

### 5. Timeouts on everything calling external systems
A slow or hung external dependency without a timeout can block the entire server —
see `building_servers.md` for the `@mcp.tool(timeout=...)` pattern.

### 6. Treat tool *descriptions* as an injection surface too, not just tool *results*
Tool descriptions are injected directly into the model's context, the same as any
other text. A malicious or compromised third-party MCP server could ship a tool
whose description contains hidden instructions aimed at the model — this is why
connecting to any MCP server (not just calling its tools) is a trust decision.
**Verify you trust a server before connecting it**, especially any server that
fetches external content.

### 7. Secrets via environment variables only, always
```python
# Never
API_KEY = "sk-abc123..."  # hardcoded — visible to anyone who reads the source

# Always
API_KEY = os.environ["API_KEY"]
if not API_KEY:
    raise RuntimeError("API_KEY environment variable required")
```

## Authentication for remote (Streamable HTTP) servers — OAuth 2.1

MCP's spec supports OAuth 2.1 for authenticating remote servers, but **MCP itself
doesn't mandate authentication** — it's the server/deployment's responsibility to
implement it. For anything beyond local development or fully trusted internal use:

```python
from mcp.server.auth import TokenVerifier

@mcp.tool()
async def delete_records(ids: list[str], ctx: Context) -> str:
    """Delete records (requires admin role)."""
    auth_info = ctx.request_context.auth_info
    if not auth_info or auth_info.get("role") != "admin":
        raise ToolError("Insufficient permissions")
    return perform_deletion(ids)
```

For production/enterprise deployments, most teams reach for a dedicated **MCP
gateway** (e.g., MintMCP, or an internal equivalent) providing centralized OAuth,
per-tool access control policies, audit logging, and prompt-injection detection —
rather than hand-rolling all of this per server. The staged authentication approach
commonly recommended: start with simple API keys for internal/trusted use, move to
full OAuth 2.1 with centralized token verification as the deployment scales to more
users or more sensitive data.

## For scalability: prefer stateless servers where practical

For servers meant to serve many concurrent remote clients, prefer designs where each
request carries all necessary context (stateless) rather than depending on
session-pinned server-side state — reserve genuinely stateful server-side resources
(e.g., an active database transaction cursor tied to one session) for cases that
truly require it, since statelessness simplifies horizontal scaling and reduces the
blast radius of any single compromised session.

## Practical guidance — the short version

1. **Assume any content a tool/resource surfaces from outside your direct control
   (web pages, issues, emails, uploaded files) can contain injected instructions** —
   design accordingly rather than trusting it implicitly.
2. **Scope every credential to the minimum required** — the single most impactful
   lesson from the GitHub MCP incident.
3. **Never mount broad filesystem access** in containerized deployments.
4. **Start read-only; add destructive tools only after observing stable behavior.**
5. **Verify trust before connecting to any third-party server** — a malicious tool
   description is as much a risk as a malicious tool result.
6. **Use environment variables for all secrets, no exceptions.**
7. **For production remote servers, implement OAuth 2.1** (or use a gateway that
   does), rather than shipping an unauthenticated Streamable HTTP endpoint.