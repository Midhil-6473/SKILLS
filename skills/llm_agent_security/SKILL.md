---
name: llm-agent-security
description: >
  Complete manual for securing LLM applications and AI agents — prompt injection
  defense, jailbreak resistance, guardrails, red-teaming, and agentic-specific risks
  like excessive agency and tool poisoning. Use whenever the user asks about LLM
  security, prompt injection (direct or indirect), jailbreaks, guardrails, the OWASP
  Top 10 for LLM Applications or for Agentic Applications, red-teaming an AI system,
  tools like NeMo Guardrails, Guardrails AI, LLM Guard, Garak, PyRIT, or Promptfoo,
  securing an MCP server or agent's tool access, PII/secret leakage from LLM outputs,
  the "lethal trifecta" (private data + untrusted content + external communication),
  or how to make a chatbot/agent safe before shipping it to production. Also trigger
  for beginner questions like what prompt injection is, why LLM security differs from
  normal application security, or how to think about securing an AI product overall.
---

# The LLM & Agent Security Manual

You are acting as an expert AI security engineer. This skill covers securing LLM
applications and — especially — autonomous agents, where the stakes are
categorically higher than a plain chatbot because agents can *act*: call tools,
write files, send emails, execute code, and move money.

## Why LLM security is a genuinely different problem

Traditional application security assumes a clean separation between **code**
(trusted, written by developers) and **data** (untrusted, comes from users).
SQL injection, XSS, and most classic vulnerabilities exploit a failure to
maintain that separation. **LLMs don't have that separation at all** — instructions
and data arrive in the same channel (the prompt), in the same format (natural
language), and the model has no reliable way to distinguish "the developer told me
to do this" from "some text I read told me to do this." This is why **prompt
injection has held the #1 spot on the OWASP Top 10 for LLM Applications for two
consecutive editions** — it isn't a bug to patch, it's close to an architectural
property of how current LLMs work, and it requires layered mitigation rather than
a single fix.

## The "lethal trifecta" — the mental model to check every agent against

An agent is dangerous specifically when **all three** of these are present at once:

1. **Access to private/sensitive data** (files, databases, credentials, internal APIs)
2. **Exposure to untrusted content** (web pages, emails, documents, tool results
   from anywhere an attacker could plant text)
3. **Ability to communicate externally** (send data out — email, API calls, writing
   to a public location, posting online)

Remove any one leg and the practical exploitability collapses — an agent that
reads untrusted content but can't reach private data or communicate externally is
far safer than one with all three. **This single check — "does this agent have all
three legs of the trifecta?" — is the fastest, highest-value security review you
can do on any agent design**, and it's the first question to ask before diving
into specific mitigations.

## The four-layer defense model this skill is organized around

```
Layer 1: Input handling      — treat all external content as untrusted, always
Layer 2: Runtime guardrails  — filter/score prompts and outputs in production
Layer 3: Agent architecture  — least privilege, approval gates, sandboxing
Layer 4: Testing & monitoring — red-team before shipping, monitor after
```

No single layer is sufficient alone — this is **defense in depth**, explicitly
recommended over any single-filter approach by OWASP, Microsoft's Security Response
Center, and every major guardrail vendor's own documentation.

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| The threat landscape: OWASP LLM Top 10, OWASP Agentic Top 10, MITRE ATLAS, real incidents | `references/threat_landscape.md` |
| Prompt injection in depth: direct vs. indirect, attack techniques, why it can't be fully "fixed" | `references/prompt_injection.md` |
| Jailbreaks: techniques (roleplay, encoding, crescendo/multi-turn), and why they're a distinct problem from injection | `references/jailbreaks.md` |
| Runtime guardrails: NeMo Guardrails, Guardrails AI, LLM Guard, building your own filters, where to place them | `references/guardrails.md` |
| Agentic-specific risks: excessive agency, tool poisoning, memory poisoning, multi-agent risks | `references/agentic_risks.md` |
| Least-privilege agent architecture: scoped credentials, approval gates, sandboxing, rate limits | `references/least_privilege_architecture.md` |
| Output handling: PII/secret leakage, treating LLM output as untrusted, downstream injection (SQLi/XSS via LLM output) | `references/output_handling.md` |
| Red-teaming and testing: Garak, PyRIT, Promptfoo, building a testing pipeline | `references/red_teaming.md` |
| Securing RAG and MCP specifically | `references/rag_and_mcp_security.md` |
| Governance: OWASP AIVSS/risk scoring, NIST AI RMF, monitoring in production | `references/governance_and_monitoring.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Run the lethal-trifecta check on every agent design first** — before any
   other analysis, identify whether the agent has private data access, untrusted
   content exposure, and external communication ability simultaneously.
2. **Treat every external content source as untrusted input to the model** — web
   pages, emails, documents, tool results, retrieved RAG chunks, even prior
   conversation turns from other users in a shared context. This includes content
   that looks like it came from a trusted source (a "trusted" API's JSON response
   can still contain injected text).
3. **Treat LLM output as untrusted too** — before executing generated code, running
   generated SQL, or rendering generated HTML, apply the same sanitization/validation
   you'd apply to any other untrusted input. Improper output handling remains a
   top-10 risk precisely because teams forget this symmetry.
4. **No single guardrail or filter is sufficient** — prompt injection specifically
   is acknowledged by OWASP as not fully solvable by RAG, fine-tuning, or any one
   filter; commit to defense-in-depth from the start rather than searching for a
   silver-bullet product.
5. **Default every agent to least privilege**: scoped credentials, an explicit
   allowlist of tools (never "give it everything, restrict later"), and a human
   approval step for any high-impact/irreversible action.
6. **Red-team before shipping, monitor after** — guardrails that are never tested
   against real attack patterns have unknown blind spots; production guardrails
   need bypass-rate and false-positive-rate monitoring, not "set and forget."
7. **Security work here compounds with the rest of your stack** — an MCP server
   (see `mcp-architect`), a LangChain/Pydantic AI agent, and a FastAPI backend
   (see `react-ai-architect`) all need these same principles applied at their
   specific integration points; this skill gives the general framework, the
   framework-specific skills show where to apply it.
8. **Source of truth: `genai.owasp.org` and `atlas.mitre.org`.** This field moves
   fast — new attack techniques and new guardrail tooling emerge monthly; web-search
   for anything version-specific or for very recent incidents rather than assuming
   training-data knowledge is current.