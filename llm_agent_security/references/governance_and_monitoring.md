# Governance and Monitoring — Frameworks, Production Observability

## Why governance frameworks matter beyond the OWASP lists

OWASP's Top 10 lists (see `threat_landscape.md`) catalog *what* can go wrong.
Governance frameworks like **NIST's AI Risk Management Framework (AI RMF)**
address the organizational *process* around managing that risk continuously —
useful specifically when you need to communicate AI risk posture to
non-technical stakeholders, auditors, or compliance teams, not just to other
engineers.

## NIST AI RMF — the four functions

| Function | What it covers |
|---|---|
| **Govern** | Organizational policies, roles, and accountability for AI risk — who owns this, what's the escalation path |
| **Map** | Identifying and documenting the specific risks relevant to a given AI system's context |
| **Measure** | Quantitative and qualitative assessment of identified risks — this is where red-teaming results (see `red_teaming.md`) and guardrail bypass/false-positive rates (see `guardrails.md`) feed in |
| **Manage** | Ongoing risk response — mitigation, monitoring, and incident response |

This maps cleanly onto the four-layer defense model in `SKILL.md`: **Map** is
your threat-modeling pass (the lethal-trifecta check, OWASP category review),
**Measure** is red-teaming and production monitoring, **Manage** is your
guardrails and least-privilege architecture, and **Govern** is the
organizational layer of who's accountable when something goes wrong — most
technical teams naturally cover Map/Measure/Manage but under-invest in Govern
until an incident forces the question.

## Risk scoring — communicating severity consistently

Emerging efforts (e.g., OWASP's AI Vulnerability Scoring System work) aim to
give LLM/agent vulnerabilities a consistent severity score, similar in spirit to
CVSS for traditional vulnerabilities — useful for prioritizing which findings
from a red-team report actually need fixing first, rather than treating every
finding as equally urgent. Even without a formal scoring system, apply a
consistent internal framework:

```python
# A simple internal severity framework, if no formal system is adopted
def assess_severity(finding: dict) -> str:
    # Does this touch the lethal trifecta? (private data + untrusted content + external comms)
    trifecta_complete = finding["has_data_access"] and finding["processes_untrusted"] and finding["can_communicate_externally"]
    if trifecta_complete and finding["action_is_irreversible"]:
        return "CRITICAL"
    if trifecta_complete:
        return "HIGH"
    if finding["has_data_access"] or finding["can_communicate_externally"]:
        return "MEDIUM"
    return "LOW"
```

This deliberately reuses the lethal-trifecta framework from `SKILL.md` as the
core severity signal — a finding that completes all three legs and involves an
irreversible action deserves urgent attention; a finding that's contained to
one leg is lower priority, all else equal.

## Production monitoring — what to actually track

Beyond standard application monitoring (see this collection's
`docker-k8s-mlops` skill's `monitoring_and_drift.md` for the general
infrastructure/quality monitoring split this extends):

```python
# Security-specific metrics worth exposing alongside your normal observability stack
GUARDRAIL_BLOCKS = Counter("guardrail_blocks_total", "Requests blocked by guardrails", ["scanner", "reason"])
GUARDRAIL_FALSE_POSITIVES = Counter("guardrail_false_positives_total", "User-reported false blocks")
TOOL_CALLS_BY_RISK_TIER = Counter("tool_calls_total", "Tool calls by risk tier", ["tool_name", "risk_tier"])
APPROVAL_GATE_DECISIONS = Counter("approval_gate_decisions_total", "Human approval outcomes", ["decision"])
INJECTION_SCAN_SCORES = Histogram("injection_scan_score", "Distribution of injection classifier scores")
```

**Track bypass rate AND false-positive rate together, always** — a guardrail
tuned only to minimize false positives will let more real attacks through; a
guardrail tuned only to minimize bypass will frustrate legitimate users. Neither
number alone tells you if your tuning is actually correct; the pair does.

## Alerting on security-relevant anomalies

```yaml
groups:
  - name: llm-security-alerts
    rules:
      - alert: InjectionAttemptSpike
        expr: rate(guardrail_blocks_total{reason="prompt_injection"}[5m]) > 10
        annotations:
          summary: "Unusual spike in detected prompt injection attempts — possible active attack"

      - alert: HighRiskToolCallSpike
        expr: rate(tool_calls_total{risk_tier="high"}[5m]) > 5
        annotations:
          summary: "Unusual volume of high-risk tool calls — review for compromised agent behavior"

      - alert: ApprovalGateBypassAttempt
        expr: increase(approval_gate_decisions_total{decision="rejected"}[10m]) > 3
        annotations:
          summary: "Multiple rejected approval requests in a short window — possible probing behavior"
```

A spike in blocked injection attempts, high-risk tool calls, or rejected
approval requests is itself a security signal worth alerting on — it can
indicate either an active attack in progress, or (just as usefully) a guardrail
miscalibration generating excessive false positives that need tuning.

## Incident response — before you need it

Have an answer to these questions **before** an incident, not during one:

1. If a guardrail bypass is confirmed in production, what's the immediate
   response — disable the affected tool? Roll back the deployment? Both?
2. If an agent is confirmed to have taken an unauthorized action, how do you
   determine blast radius? (This is exactly what the audit logging in
   `least_privilege_architecture.md` is for.)
3. Who is accountable for the decision to resume service after an incident —
   this is the "Govern" function from NIST AI RMF, made concrete.
4. Is there a rollback path for any state the agent may have mutated
   (database writes, sent communications, persistent memory) — see this
   collection's `docker-k8s-mlops` skill's `cicd_and_gitops.md` for the
   deployment-rollback half of this, and note that *data* rollback (undoing an
   agent's actual actions) is often harder and needs its own explicit plan.

## Keeping guardrails current

```
Attack techniques evolve continuously — a guardrail rule set is a snapshot,
not a permanent solution. Practical cadence:
- Subscribe to OWASP GenAI Security Project updates
- Re-run the full red-team suite (see red_teaming.md) after any prompt,
  tool, or model version change — not just on a fixed calendar schedule
- Review new CVEs/incidents in the ecosystem (similar to the MCP-specific
  ones covered in mcp-architect's security.md) for patterns applicable
  to your own system
```

## Practical guidance

1. **Use NIST AI RMF's four functions as a checklist for organizational
   completeness** — most teams cover Measure/Manage well but neglect Govern
   until forced to by an incident.
2. **Reuse the lethal-trifecta framework as your severity-scoring signal** —
   it's already the highest-value single question in this skill, and it
   doubles as a consistent prioritization tool for red-team findings.
3. **Always track bypass rate and false-positive rate together** — either alone
   gives a misleading picture of whether your guardrail tuning is correct.
4. **Alert on security-relevant anomalies** (injection attempt spikes,
   high-risk tool call spikes, approval rejections) as a distinct category from
   generic application health alerts.
5. **Write your incident response plan before you need it** — especially the
   data/action rollback question, which is often harder than infrastructure
   rollback and easy to leave unanswered until it's too late.