# Agentic-Specific Risks — Excessive Agency, Tool Poisoning, Memory Poisoning

## Why agents are categorically riskier than chatbots

A chatbot that's successfully jailbroken or injected produces bad *text*. An
agent that's successfully compromised can *act* — call APIs, write files, send
money, delete data, message people. The OWASP Top 10 for Agentic Applications
exists specifically because "the model said something wrong" and "the model did
something wrong" are different classes of incident with different blast radii.
This file covers the risk categories that are distinctly agentic, beyond the
base LLM Top 10.

## Excessive Agency (OWASP LLM06 / a core Agentic Top 10 theme)

The risk: an agent has more tools, broader permissions, or more autonomy (fewer
required human checkpoints) than its actual task requires. This isn't a
hypothetical — it's the **default failure mode** of most agent scaffolding
tutorials, which tend to wire up broad access early ("give it a general-purpose
shell tool," "grant it full database access") for development convenience, with
a plan to "restrict it later" that often never happens before shipping.

```python
# Excessive agency, concretely
@agent.tool
def run_database_query(sql: str) -> str:
    """Run any SQL query against the production database."""   # <- the actual problem
    return db.execute(sql)   # full read/write access, no query restriction, no approval gate

# Scoped, appropriately-limited version
@agent.tool
def get_customer_order_status(order_id: str) -> str:
    """Look up the status of a specific customer order by ID."""
    return db.execute(
        "SELECT status FROM orders WHERE id = %s", (order_id,)
    )   # narrow, parameterized, read-only, scoped to exactly the task
```

**The fix is almost always narrower, more specific tools** — not "add a
permission check inside a general tool," but "don't give the agent a general
tool in the first place." See `least_privilege_architecture.md` for the full
architectural treatment.

## Unsafe tool use and hallucinated tool calls

Two related but distinct failure modes:
1. **The agent calls a real tool with unsafe/incorrect arguments** — e.g.,
   calling a `delete_file` tool with a wildcard path because it misunderstood
   the user's intent, or was manipulated by injected content into doing so.
2. **The agent hallucinates a tool or API endpoint that doesn't exist**, and
   downstream code either errors (annoying but safe) or — worse — some
   integration silently accepts and acts on a malformed/hallucinated call.

```python
# Defend against unsafe arguments with validation INSIDE the tool, not just trusting the model
@agent.tool
def delete_file(ctx: RunContext[Deps], path: str) -> str:
    """Delete a specific file by exact path."""
    resolved = Path(ctx.deps.workspace_root, path).resolve()
    if not resolved.is_relative_to(ctx.deps.workspace_root):
        raise ToolError("Path escapes the allowed workspace — refusing to delete")
    if "*" in path or ".." in path:
        raise ToolError("Wildcard or parent-directory paths are not allowed")
    resolved.unlink()
    return f"Deleted {path}"
```

**Never trust that the model will only call a tool with sensible arguments** —
validate defensively inside every tool implementation itself, exactly as you
would validate any other untrusted input, regardless of how well-behaved the
model usually is.

## Memory and context poisoning

For agents with **persistent memory** (across sessions — see this collection's
`langchain-architect` skill's `memory.md` for the long-term memory mechanisms
this applies to), an attacker can inject false information that gets written
into memory and then **compounds through self-reinforcement** across future
interactions:

- Injecting false product details that accumulate in long-term memory over
  repeated conversations.
- Implanting false "facts" the agent later treats as established context,
  progressively worsening as the agent references its own prior (poisoned)
  outputs as if they were verified truth.
- A RAG system that stores its own generated outputs back into the retrieval
  store is specifically vulnerable to this pattern — poisoning with minimal
  injected content can compound across successive retrieval/generation cycles.

**Mitigations**: treat anything written to persistent memory as requiring the
same scrutiny as any other untrusted-content ingestion point (scan before
writing, not just before reading); avoid architectures where an agent's own
unverified output becomes a trusted future input without a human or independent
verification step in between; version/audit memory writes so poisoning can be
identified and rolled back.

## Multi-agent trust exploitation

In multi-agent systems (see `langchain-architect`'s `langgraph_multiagent.md`
for the underlying orchestration patterns this risk applies to), a compromised
or manipulated agent can propagate the attack to other agents it delegates to
or coordinates with — because agent-to-agent communication is often trusted more
implicitly than user-to-agent communication ("this came from another part of my
own system, surely it's safe").

**Don't grant inter-agent messages elevated trust by default** — a message from
Agent A to Agent B should generally receive comparable scrutiny to a message
from an external source, especially if Agent A itself processes any untrusted
content (web browsing, document ingestion, user-submitted text) anywhere in its
own workflow. The trust boundary that matters is "has this content passed through
any untrusted-content-processing step," not "which internal component produced
this message."

## Resource abuse / unbounded consumption (OWASP LLM10, agent-amplified)

Agents can loop, retry, or fan out into many tool calls — an attacker (or a
buggy prompt) triggering runaway tool-calling behavior is a real cost and
availability risk distinct from a single expensive LLM call:

```python
# Always bound agent execution explicitly
agent = Agent(
    "claude-sonnet-4-6",
    tools=[...],
    # Most agent frameworks support some form of these — check your specific
    # framework's mechanism (e.g., LangGraph's recursion_limit, or a manual counter)
)
MAX_TOOL_CALLS_PER_RUN = 15
MAX_RUN_DURATION_SECONDS = 60
```

See this collection's `docker-k8s-mlops` skill for infrastructure-level rate
limiting (HPA, resource limits) that complements this application-level bounding
— both matter, since an unbounded agent loop can exhaust infrastructure capacity
even if each individual call is individually cheap.

## Hallucinated dependencies / API endpoints causing real data leaks

A subtler risk: an agent hallucinates a plausible-but-nonexistent API endpoint
or package name, and if any downstream automation blindly trusts and calls/installs
whatever the agent specifies (rather than validating against a known-good
allowlist), that hallucination becomes a real exploitable gap — analogous to
"slopsquatting" in the software-supply-chain sense, where an attacker
pre-registers a plausible hallucinated package name an LLM is likely to suggest.

## Practical guidance

1. **Assume the excessive-agency failure mode is the default**, not the
   exception — actively narrow tool scope rather than assuming broad access is
   fine until proven otherwise.
2. **Validate tool arguments defensively inside every tool**, never trusting
   that the model will only produce sensible inputs.
3. **Treat writes to persistent agent memory as an untrusted-content ingestion
   point**, requiring the same scrutiny as reading untrusted content.
4. **Don't grant inter-agent messages elevated trust by default** in multi-agent
   systems — the relevant boundary is "has untrusted content touched this,"
   not "which internal component sent it."
5. **Bound agent execution explicitly** (max tool calls, max duration) at the
   application level, and pair with infrastructure-level rate limiting.
6. **Validate any agent-suggested external identifier (package name, API
   endpoint, URL) against a known-good allowlist** before any automated system
   acts on it.