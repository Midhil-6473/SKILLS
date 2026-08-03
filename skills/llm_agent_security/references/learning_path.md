# Beginner → Advanced Learning Path (LLM & Agent Security)

Use this as a curriculum when the user wants a structured roadmap rather than a
point answer. Each phase names the reference file(s) to pull detail from.

## Phase 0 — Orientation (20 minutes)

- Understand why LLM security is architecturally different from traditional
  appsec (no clean instruction/data separation). See `SKILL.md`.
- Learn the lethal-trifecta framework — this single check is worth
  internalizing before anything else in this skill.
- Understand the four-layer defense model this skill is organized around.

**Practice:** Take an AI application you've already built (from any other
skill in this collection) and run the lethal-trifecta check against it —
does it have private data access, untrusted content exposure, and external
communication ability, all three at once?

## Phase 1 — The Threat Landscape

*Read: `threat_landscape.md`*

1. Learn the OWASP Top 10 for LLM Applications well enough to recognize each
   category in a real design.
2. Learn the OWASP Top 10 for Agentic Applications' additional categories.
3. Study the real incidents (Slack AI, GitHub MCP) in enough detail to
   explain exactly what went wrong and why.

**Practice:** Pick one real incident and write a one-paragraph postmortem in
your own words — what was the entry point, what made the impact worse than it
needed to be, and what single change would have prevented or limited it?

## Phase 2 — Prompt Injection

*Read: `prompt_injection.md`*

1. Understand direct vs. indirect injection and why indirect is harder to
   defend against.
2. Understand and be able to explain why RAG/fine-tuning don't solve this.
3. Try writing (in a safe, sandboxed test environment only) a few injection
   attempts against a model you control, to build intuition for what does and
   doesn't work against current safety training.

**Practice project:** Build a tiny RAG demo (a few documents, one query
endpoint) and deliberately plant an injection in one document — confirm you
can trigger unintended behavior, then apply the defensive-prompting mitigation
and observe the difference.

## Phase 3 — Jailbreaks

*Read: `jailbreaks.md`*

1. Understand how jailbreaks differ from injection (model-level vs.
   application-level trust boundary).
2. Learn the major technique families: roleplay, hypothetical framing,
   crescendo/multi-turn, encoding.
3. Understand why crescendo attacks are a distinct, underserved testing gap.

**Practice:** Read through a few documented jailbreak techniques (via Garak's
probe documentation, for instance) and categorize each into the technique
families covered in this file.

## Phase 4 — Guardrails

*Read: `guardrails.md`*

1. Install and try LLM Guard's input/output scanning on a small test app.
2. Understand NeMo Guardrails' Colang-based approach and when it's the right
   choice vs. LLM Guard.
3. Try Guardrails AI for structured output validation.
4. Build a minimal custom regex-based filter, and understand explicitly why
   it's insufficient alone.

**Practice project:** Add LLM Guard input/output scanning to the RAG demo
from Phase 2, and confirm it catches (or at least flags) the injection
attempt you planted earlier.

## Phase 5 — Agentic Risks

*Read: `agentic_risks.md`*

1. Understand excessive agency as the default failure mode of most agent
   tutorials.
2. Understand memory/context poisoning, especially in self-reinforcing RAG
   architectures.
3. Understand multi-agent trust exploitation.

**Practice:** Audit a multi-tool agent you've built (from
`langchain-architect` or `pydantic-architect`) — for each tool, ask "is this
the narrowest possible scope for its purpose, or did I expose something
broader for convenience?"

## Phase 6 — Least-Privilege Architecture

*Read: `least_privilege_architecture.md`*

1. Practice narrowing an overly broad tool (e.g., a general SQL-execution
   tool) into specific, scoped tools.
2. Add a human-approval gate to a genuinely high-impact action in a test
   agent.
3. If you have a code-execution tool anywhere, verify it runs in a real
   sandbox, not just with a polite prompt instruction.

**Practice project:** Take the agent from Phase 5's audit and actually
implement the narrowing — replace at least one broad tool with 2-3 narrow,
validated ones, and add an approval gate to any irreversible action.

## Phase 7 — Output Handling

*Read: `output_handling.md`*

1. Understand the symmetry principle: LLM output is untrusted input to
   whatever consumes it next.
2. Add output scanning for secrets/PII to a test application.
3. If any part of your stack generates and executes SQL/code, add
   allowlist-based validation before execution.

**Practice:** Review any LLM-generated-then-executed content in a project
you've built (generated SQL, generated file paths, generated shell commands)
and confirm it's validated before execution, not just trusted.

## Phase 8 — Red-Teaming

*Read: `red_teaming.md`*

1. Run Garak's probe suite against a test model/application.
2. Try Promptfoo with the OWASP preset for CI/CD-style regression testing.
3. If feasible, try a PyRIT crescendo campaign against a test target.
4. Write 2-3 custom test cases targeting your own application's specific
   tools.

**Practice project:** Set up a Promptfoo config with the OWASP preset for
the agent you've been building across this learning path, and get it running
as part of a CI check (even a manual one) — this closes the loop from "we
think it's secure" to "we verify it's secure on every change."

## Phase 9 — RAG and MCP Security

*Read: `rag_and_mcp_security.md`*

1. Apply ingestion-time scanning to a RAG pipeline.
2. Verify multi-tenant filtering (if applicable) at both application and
   database layers.
3. Review any connected MCP servers against the trust checklist.

**Practice:** Run the combined RAG + MCP + Agent threat model checklist from
this file against the most complete system you've built across this learning
path.

## Phase 10 — Governance and Monitoring

*Read: `governance_and_monitoring.md`*

1. Map your project against NIST AI RMF's four functions — identify which
   you've covered well and which (likely Govern) you haven't.
2. Add basic security-specific metrics (guardrail blocks, high-risk tool
   calls) alongside your normal application monitoring.
3. Write a one-page incident response plan for your project, answering the
   four questions in this file.

**Practice project:** Write the incident response plan for real — this is
often skipped as "not real work," but forcing yourself through the four
questions (immediate response, blast radius determination, accountability,
rollback path) surfaces gaps that are much cheaper to find now than during an
actual incident.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer
securing a production system):
- Build one cumulative project (the RAG + agent demo from Phases 2-9 is a
  good default) rather than disconnected examples — by Phase 10 it should be
  a genuinely defended, tested, monitored system.
- Emphasize the lethal-trifecta framework and least-privilege architecture
  above all else if time is limited — these two ideas alone cover the highest
  fraction of real-world risk reduction relative to effort invested.
- Always test attacks (Phase 2's injection planting, Phase 8's red-teaming)
  in a sandboxed environment the learner controls — never against a real
  production system or a system they don't own, and be explicit about this
  boundary.
- Check understanding with a "spot the vulnerability" exercise before
  advancing — e.g., "before moving to guardrails, look at this tool
  definition — what's the excessive-agency problem with it?"