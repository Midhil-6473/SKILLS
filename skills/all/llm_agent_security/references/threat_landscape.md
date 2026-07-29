# The Threat Landscape — OWASP Top 10s, MITRE ATLAS, Real Incidents

## OWASP Top 10 for LLM Applications (2025 edition)

The most widely referenced framework for LLM application risk. First released
2023, substantially updated for 2025 based on real-world incidents and the rapid
growth of agentic AI.

| Rank | Risk | Core issue |
|---|---|---|
| LLM01 | **Prompt Injection** | Instructions and data share one channel; the model can't reliably distinguish them. Holds #1 for two consecutive editions. |
| LLM02 | **Sensitive Information Disclosure** | The model leaks PII, secrets, or confidential data from training data, context, or connected systems. |
| LLM03 | **Supply Chain** | Compromised training data, malicious pretrained models/adapters, poisoned dependencies (a growing concern as more teams pull models/datasets from public hubs). |
| LLM04 | **Data and Model Poisoning** | Training or fine-tuning data manipulated to embed backdoors or bias. |
| LLM05 | **Improper Output Handling** | LLM output fed downstream (to a DB, a shell, a browser) without the same sanitization applied to any other untrusted input — dropped from #2 to #5 in 2025 but remains critical. |
| LLM06 | **Excessive Agency** | The agent has more tools, broader permissions, or more autonomy (fewer human checkpoints) than its task actually requires. |
| LLM07 | **System Prompt Leakage** | The system prompt itself (often containing business logic, credentials, or internal instructions) is extracted by the user. |
| LLM08 | **Vector and Embedding Weaknesses** | RAG-specific: poisoned embeddings, cross-tenant data leakage via shared vector stores, embedding inversion. |
| LLM09 | **Misinformation** | Confident, plausible-sounding but false output — a risk in itself, not just a UX quality issue, in high-stakes domains. |
| LLM10 | **Unbounded Consumption** | Resource exhaustion — a user (or an attacker) triggers unbounded token generation, excessive tool calls, or runaway cost. |

**Prompt injection's persistence at #1 is the single most important fact to
internalize**: it's not there because nobody has tried to fix it — it's there
because LLMs process instructions and data in the same channel by architectural
design, so an attacker can craft input the model interprets as a new instruction
rather than content to process, and the model genuinely cannot tell the difference
with full reliability.

## OWASP Top 10 for Agentic Applications (announced Black Hat Europe 2025)

A newer, companion framework specifically for autonomous agents — because agentic
systems introduce risk categories that don't exist in a plain chatbot:

- **Autonomous decision-making** — the agent independently determines steps to
  reach a goal, not just responding to one prompt at a time.
- **Persistent memory** — both short-term (within a session) and long-term
  (across sessions) memory that can itself be poisoned or manipulated.
- **Tool and API access** — direct interaction with external systems, meaning a
  compromised agent doesn't just say something wrong, it *does* something wrong.
- **Multi-agent coordination** — complex inter-agent communication and delegation,
  where an attack on one agent can propagate to others it coordinates with.

Key agentic-specific risk categories (see `agentic_risks.md` for the full
treatment): excessive agency, unsafe tool use, memory/context poisoning
(injecting false information that accumulates in persistent memory and worsens
through self-reinforcement), hallucinated tool/API endpoints causing data leaks,
and multi-agent trust exploitation.

## MITRE ATLAS — the adversarial tactics catalog

**MITRE ATLAS** (Adversarial Threat Landscape for AI Systems) is a structured
knowledge base of adversarial tactics and techniques against AI systems, modeled
on the well-known MITRE ATT&CK framework for traditional cybersecurity. As of late
2025, ATLAS catalogs 16 tactics and 84 techniques — useful specifically for
mapping a *specific* observed or hypothesized attack to a structured taxonomy,
the way ATT&CK is used in traditional incident response and threat modeling.

## The "prompt injection is the new SQL injection" framing

A framing repeated across the field in 2026: prompt injection sits at #1 for the
same structural reason SQL injection sat at #1 on the classic OWASP Top 10 for a
decade — it exploits the fundamental trust boundary between user input and the
engine interpreting it, and **it cannot be fixed with a single filter**. The
practical implication: the mitigations that eventually tamed SQL injection
(parameterized queries — a structural fix, not a filter) don't have a clean LLM
equivalent yet, which is exactly why defense-in-depth (multiple independent
layers) is the field's current consensus approach rather than a single silver
bullet.

## Real, documented incidents worth knowing

- **Slack AI data exfiltration via indirect prompt injection** (PromptArmor,
  2024) — a message planted in a Slack channel contained hidden instructions that,
  when Slack AI summarized/processed the channel, caused it to exfiltrate private
  data to the attacker.
- **The GitHub MCP server incident** (Invariant Labs, 2025) — a malicious GitHub
  issue's text hijacked an AI agent (using the official GitHub MCP server) into
  leaking private repository data into a public pull request; made materially
  worse by an overly broad access token (see this collection's `mcp-architect`
  skill, `security.md`, for the full writeup).
- **Retrieval poisoning in self-reinforcing RAG systems** — research has
  demonstrated that systems which store their own generated outputs back into the
  retrieval store are vulnerable to poisoning with minimal injected content, since
  poisoned content can compound over successive retrieval/generation cycles.
- **Measured injection success rates against production frontier models** —
  Anthropic's own Claude Opus 4.5 system card reports indirect prompt-injection
  attack success rates in agentic coding environments (via the Gray Swan Shade red-
  teaming tool) of roughly 4.7% at one attempt, climbing to 33.6% at ten attempts
  and 63.0% at one hundred attempts — a concrete, vendor-published illustration
  that injection resistance is probabilistic, degrades with attacker persistence,
  and is not a solved problem even in frontier models with active mitigations.

## Governance frameworks referenced alongside the OWASP lists

- **NIST AI Risk Management Framework (AI RMF 1.0)** — maps risk to four
  functions: Govern, Map, Measure, Manage. The framework most US enterprises cite
  when writing internal AI policy, often alongside the OWASP Top 10.
- **NIST AI 600-1** — the Generative AI Profile, a more GenAI-specific extension
  of the base RMF.

## Practical guidance

1. **Know the OWASP LLM Top 10 well enough to check a design against it from
   memory** — it's the field's shared vocabulary, and citing "this is an LLM06
   excessive agency issue" communicates precisely to any security-literate
   reviewer.
2. **For anything agentic, also check against the OWASP Agentic Top 10
   categories** — the base LLM list under-covers persistent memory poisoning and
   multi-agent risk specifically.
3. **Treat injection resistance as probabilistic, not binary** — even frontier
   models with active defenses show meaningfully higher success rates for
   attackers willing to make many attempts; design defenses assuming determined
   attackers get more tries, not just one.
4. **Study real incidents, not just the abstract risk categories** — the Slack AI
   and GitHub MCP cases are concrete enough to directly inform design reviews of
   your own systems.