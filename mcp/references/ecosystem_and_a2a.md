# The MCP Ecosystem — Existing Servers, Registry, A2A, and Where It's Heading

## Scale of adoption (context for why this matters)

MCP was released by Anthropic in November 2024. Within about 18 months it became the
de facto standard for AI tool integration: adopted by OpenAI, Google DeepMind, and
Microsoft in addition to Anthropic; Python SDK downloads reaching well into the tens
of millions per month; tens of thousands of community server implementations across
public directories. In December 2025, Anthropic, Block (Square), and OpenAI
established the **Agentic AI Foundation** under the Linux Foundation, contributing
both MCP and the related A2A protocol as shared, vendor-neutral infrastructure — a
strong signal MCP is being treated as durable, cross-industry infrastructure rather
than a single vendor's proprietary standard.

## Official reference servers and the community ecosystem

Anthropic maintains official reference implementations for common systems:
- **Filesystem** — scoped local file access
- **Git / GitHub** — repository operations
- **Google Drive**
- **Slack**
- **Postgres**
- **Puppeteer** — browser automation

Beyond the official set, the community ecosystem now covers the large majority of
popular SaaS platforms and developer tools — Notion, Jira, Salesforce, Stripe, Figma,
Docker, Kubernetes, and hundreds of others. Before building a custom server for a
well-known third-party service, **check whether an official or well-maintained
community server already exists** — `github.com/modelcontextprotocol/servers` is the
canonical starting point, and the **MCP Registry** provides a searchable directory.

## The MCP Registry

A centralized, searchable directory of published MCP servers — analogous to how npm
or PyPI centralize package discovery. Reduces the "which server do I actually trust
and install" problem as the ecosystem has scaled into the thousands of
implementations, and is where hosts like Claude Code's "Directory" browsing pulls
reviewed, pre-vetted connectors from.

## A2A (Agent-to-Agent) — MCP's complementary protocol, not a competitor

Released by Google in April 2025, **A2A** addresses a different problem than MCP:

| | MCP | A2A |
|---|---|---|
| **Defines** | How an agent interacts with tools and data | How agents collaborate with *other agents* |
| **Typical use** | An agent queries a CRM, reads a file, calls a calculator | One agent delegates a subtask to a different, specialized agent and receives results back |

**They compose, not compete.** A realistic example: a customer support agent queries
CRM and knowledge-base systems via MCP, then delegates a complex technical issue to a
separate technical-support agent via A2A — individual tool/data access stays on MCP;
cross-agent task delegation happens on A2A. Both protocols are now under the same
Agentic AI Foundation umbrella, reinforcing that they're meant to be used together in
sophisticated multi-agent systems.

If you're already building multi-agent systems with LangGraph's supervisor/swarm
patterns (see the `langchain-architect` skill), think of A2A as a *protocol-level*
standardization of agent-to-agent handoffs analogous to what LangGraph's `Command`
handoff pattern does within a single framework — useful when agents span different
frameworks or organizations, less necessary when everything lives inside one
LangGraph application.

## Where MCP is heading (2026 roadmap themes)

- **Stateless server operation** maturing further, making horizontal scaling of
  remote MCP servers more straightforward.
- **Automatic discovery via MCP Server Cards** — richer, more structured metadata
  about what a server offers, reducing manual configuration.
- **Deeper A2A coordination** — MCP and A2A maturing together into what's described
  as the foundational infrastructure for multi-agent orchestration broadly, not just
  single-agent tool use.
- **Protocol hardening around security and observability** — gateways, governance
  tooling, and stronger default authentication patterns emerging in direct response
  to the real vulnerabilities covered in `security.md`.
- **Enterprise governance tooling** — centralized MCP gateways (audit logs,
  per-tool RBAC, prompt-injection detection) increasingly treated as standard
  infrastructure for any organization deploying MCP beyond individual developer use,
  not an optional extra.

## Practical guidance

1. **Check the official servers list and the MCP Registry before building a custom
   server** for any well-known third-party service — a maintained community server
   likely already exists.
2. **Don't confuse MCP and A2A** — MCP is tool/data access; A2A is agent-to-agent
   delegation. Most single-application agent systems only need MCP.
3. **Treat MCP as durable infrastructure**, not a single-vendor bet — its
   cross-industry adoption and Linux Foundation stewardship are strong signals for
   long-term investment in learning it well.
4. **For enterprise/production deployments spanning many servers and users**,
   evaluate a dedicated MCP gateway rather than hand-rolling governance, auth, and
   audit logging per server.