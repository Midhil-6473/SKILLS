# Least-Privilege Agent Architecture

## Why this is the highest-leverage mitigation

Across every source in `threat_landscape.md` and `prompt_injection.md`, one
recommendation appears consistently as the top mitigation: **limiting what an
agent can do bounds the damage from injection, jailbreaks, and misuse — even
when the attack itself isn't caught.** You cannot guarantee detection of every
prompt injection or jailbreak attempt (see `prompt_injection.md` — it's
acknowledged as not fully solvable). You *can* guarantee that even a fully
compromised agent can only cause bounded, limited damage, if its actual
permissions are scoped tightly enough. This makes least-privilege architecture
the one mitigation that remains effective even in the worst case where every
other layer fails.

## Scoped credentials — the GitHub MCP lesson, generalized

```python
# Bad: one broad credential used for everything the agent might ever need
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]  # full repo access, org-wide

# Better: scope credentials per capability, minimum necessary for each
GITHUB_READ_ISSUES_TOKEN = os.environ["GITHUB_READ_ISSUES_TOKEN"]   # read-only, issues only
GITHUB_CREATE_PR_TOKEN = os.environ["GITHUB_CREATE_PR_TOKEN"]        # write, but PR-creation only, no merge
```

This is the exact lesson from the real GitHub MCP server incident (see
`threat_landscape.md`) — the injection succeeded at hijacking the agent, but the
*damage* was made materially worse specifically by an overly broad access token.
A narrowly-scoped token wouldn't have prevented the injection, but would have
sharply limited what the injected agent could actually accomplish.

## Tool allowlisting — explicit, not implicit

```python
# Bad: exposing a general-purpose capability and hoping the model uses it responsibly
@agent.tool
def execute_shell_command(command: str) -> str:
    """Execute any shell command."""
    return subprocess.run(command, shell=True, capture_output=True).stdout

# Good: an explicit, narrow allowlist of specific, safe operations
@agent.tool
def list_project_files(ctx: RunContext[Deps]) -> list[str]:
    """List files in the current project directory."""
    return [f.name for f in ctx.deps.workspace_root.iterdir()]

@agent.tool
def read_file_contents(ctx: RunContext[Deps], filename: str) -> str:
    """Read the contents of a specific file in the project directory."""
    path = _validate_and_resolve(ctx.deps.workspace_root, filename)
    return path.read_text()
```

**Never expose a general-purpose "do anything" tool** (raw shell access, raw SQL
execution, an unrestricted HTTP client) and rely on the system prompt or the
model's judgment to constrain its use safely — the system prompt is exactly what
prompt injection targets, so any restriction that lives only in the prompt is
exactly the restriction an injection attack is trying to bypass. Restrictions
that live in code (which tools exist at all, what arguments they accept, what
they're capable of touching) survive a successful injection; restrictions that
live only in the prompt do not.

## Human-in-the-loop approval gates for high-impact actions

```python
IRREVERSIBLE_ACTIONS = {"send_email", "delete_record", "make_payment", "merge_pr"}

@agent.tool
async def send_email(ctx: RunContext[Deps], to: str, subject: str, body: str) -> str:
    """Send an email. Requires human approval before sending."""
    approval = await request_human_approval(
        action="send_email",
        details={"to": to, "subject": subject, "body_preview": body[:200]},
    )
    if not approval.approved:
        return "Action cancelled — not approved by user."
    return await actually_send_email(to, subject, body)
```

This is precisely the human-in-the-loop pattern covered in this collection's
`react-ai-architect` (`agentic_ui_patterns.md`) and `mcp-architect`
(`advanced_features.md`) skills — the security framing here is the *why*:
an approval gate is the last line of defense that catches a successful
injection or a genuine model error before it becomes an irreversible real-world
action. **Reserve this for genuinely high-impact/irreversible actions** — gating
every single tool call on human approval defeats the purpose of automation and
trains users to click "approve" reflexively without real scrutiny (a well-known
"approval fatigue" failure mode that undermines the control's actual value).

## Sandboxing — isolating execution, not just restricting arguments

For any agent capability involving code execution or file/shell access (see this
collection's `docker-k8s-mlops` skill and `mcp-architect`'s security coverage of
`ShellToolMiddleware` execution policies), the security boundary should be the
**sandbox itself**, not the model's cooperation:

```python
# The "trust the LLM" anti-pattern — the model is asked nicely to behave
@agent.tool
def run_python_code(code: str) -> str:
    """Execute Python code."""
    return exec(code)   # full host access — a single successful injection is catastrophic

# The sandboxed pattern — isolation is the actual security boundary
@agent.tool
def run_python_code(code: str) -> str:
    """Execute Python code in an isolated sandbox."""
    return sandbox_client.execute(code, timeout=10, memory_limit_mb=256, network_access=False)
```

This is the same principle covered in `mcp-architect`'s `security.md` and
`docker-k8s-mlops`'s `gpu_containers.md`/deployment guidance: **never rely on
the model's cooperation as the actual security boundary** — a determined or
successfully-manipulated agent will use whatever the execution environment
technically permits, regardless of what it was told not to do.

## Rate limits and execution bounds

```python
from datetime import timedelta

class AgentExecutionLimits:
    max_tool_calls_per_run: int = 15
    max_run_duration: timedelta = timedelta(minutes=2)
    max_runs_per_user_per_hour: int = 20
    max_cost_per_run_usd: float = 1.00
```

Bounding execution isn't just a cost-control measure (though it is that too —
see `agentic_risks.md`'s unbounded-consumption coverage) — it's also a security
control, since it limits how much damage a single compromised or manipulated
run can accomplish before hitting a hard stop.

## Detailed audit logging

```python
async def log_tool_call(tool_name: str, args: dict, result: str, user_id: str):
    await audit_log.insert({
        "timestamp": datetime.utcnow(),
        "user_id": user_id,
        "tool_name": tool_name,
        "arguments": args,       # log the FULL arguments, not a summary
        "result_preview": result[:500],
        "agent_run_id": current_run_id(),
    })
```

Every tool call an agent makes should be logged with enough detail to
reconstruct exactly what happened during a post-incident investigation — this is
the same principle as the observability coverage in this collection's
`pydantic-architect` skill (`observability_and_evals.md`), applied specifically
through a security/audit lens rather than a debugging/quality lens. Audit logs
are what turns "we think something bad happened" into "here's exactly what the
agent did, when, with what arguments, and what the result was."

## Putting it together — a scoped agent deployment checklist

1. Does every tool have the narrowest possible scope for its actual purpose?
   (Not "database access" — "read order status by ID.")
2. Does every credential the agent uses have the minimum necessary permissions?
3. Is there an explicit allowlist of tools (not a general-purpose escape hatch
   like raw shell/SQL access)?
4. Do irreversible/high-impact actions require human approval?
5. Does any code-execution or shell-access capability run in a real sandbox,
   not just "the model was told to be careful"?
6. Are there hard limits on tool calls, run duration, and cost per run?
7. Is every tool call logged with full arguments for audit/incident response?

## Practical guidance

1. **Treat least privilege as your primary, load-bearing mitigation** — every
   other defense in this skill is complementary, but this is the one that still
   works when everything else fails.
2. **Put restrictions in code, not in the prompt** — prompt-based restrictions
   are exactly what injection attacks target and bypass.
3. **Never expose general-purpose "do anything" tools** — narrow, specific tools
   with validated arguments, even if it means writing more tool functions.
4. **Reserve human approval gates for genuinely high-impact actions** — overuse
   causes approval fatigue and defeats the control's purpose.
5. **Sandbox any code/shell execution capability** — the sandbox, not model
   cooperation, must be the actual security boundary.