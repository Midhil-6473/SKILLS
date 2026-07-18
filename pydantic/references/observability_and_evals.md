# Observability and Evals — Logfire, OpenTelemetry, Pydantic Evals

## Logfire — Pydantic AI's native observability platform

**Pydantic Logfire** is an OpenTelemetry-based observability platform built by the
same team, designed to integrate with Pydantic AI with minimal setup.

```python
import logfire
from pydantic_ai import Agent

logfire.configure()
logfire.instrument_pydantic_ai()   # one line — instruments every agent in the process

agent = Agent("claude-sonnet-4-6", output_type=ReviewResult)
result = agent.run_sync("...")
```

With this instrumentation active, every `agent.run()` call emits a trace
including: the model used and tokens consumed, each tool call with its inputs and
outputs, validation results (including any retries triggered by schema
validation failures), and timing for each step — visible in the Logfire dashboard
without any additional manual logging code.

## Using a non-Logfire OTel backend

```python
# Pydantic AI emits standard OpenTelemetry spans — any OTel-compatible backend works
import logfire

logfire.configure(send_to_logfire=False)   # emit OTel spans without sending to Logfire's SaaS
logfire.instrument_pydantic_ai()
# Configure your OTel exporter to point at Datadog, Honeycomb, Jaeger, or any
# other OTel-compatible backend per that backend's standard configuration
```

**You are not locked into Logfire specifically** — since instrumentation is
standard OpenTelemetry underneath, any OTel-compatible observability backend
(Datadog, Honeycomb, Jaeger, Grafana Tempo) can receive the same traces. This
matters for teams already standardized on a different observability stack.

## What to actually look at in traces

- **Token usage per run** — track cost, not just latency; LLM cost scales with
  usage in a way traditional API costs don't.
- **Tool call inputs/outputs** — debug incorrect tool selection or malformed
  arguments directly from the trace, rather than reproducing the issue manually.
- **Validation retry count** — a high retry rate on a specific `output_type`
  schema is a direct signal to either loosen the schema or improve the system
  prompt's description of the expected output (see `structured_outputs.md`).
- **Model/provider used per run** — essential when running A/B comparisons across
  providers/models, or when debugging a regression that coincides with a model
  swap.

## Pydantic Evals — systematically testing agent quality

Unlike traditional software (where "correct" is usually binary), agent behavior
needs evaluation against a broader notion of quality — **Pydantic Evals** provides
a framework for defining test cases and scoring criteria for agent behavior, then
tracking pass rates over time.

```python
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import IsInstance, LLMJudge

dataset = Dataset(
    cases=[
        Case(
            name="basic_extraction",
            inputs="Extract the invoice total from: Total due: $150.00",
            expected_output=Invoice(vendor="Unknown", total=150.00, line_items=[]),
        ),
        Case(
            name="ambiguous_input",
            inputs="This document has no clear total",
            evaluators=[LLMJudge(rubric="The agent should indicate uncertainty rather than guessing a number")],
        ),
    ],
    evaluators=[IsInstance(type_name="Invoice")],
)

report = await dataset.evaluate(agent_function)
report.print()   # pass/fail summary across all cases
```

**`LLMJudge`** is notable — for outputs that don't have a single objectively
correct value (open-ended generation, summarization quality, appropriate tone),
you can use a separate LLM call as the evaluator against a plain-language rubric,
rather than requiring exact-match assertions that don't fit fuzzy, generative
tasks.

## Why plain-language eval criteria matters for compliance-heavy domains

A real-world pattern worth knowing: because Pydantic Evals rubrics can be written
in plain language rather than opaque code, **non-engineering stakeholders
(compliance teams, domain experts) can read and approve the same evidence
engineering uses to gate a deploy** — this has been used specifically in regulated
industries (healthcare, compliance/quality platforms) to let customers' compliance
teams review AI behavior evidence directly, rather than needing a technical
translation layer.

## Gating deploys on eval pass rate

```python
# In CI (see this skill collection's docker-k8s-mlops skill, cicd_and_gitops.md,
# for the surrounding pipeline context)
report = await dataset.evaluate(agent_function)
pass_rate = report.pass_rate()

if pass_rate < 0.95:
    raise SystemExit(f"Eval pass rate {pass_rate:.1%} below required threshold — blocking deploy")
```

Treating eval pass rate as a CI gate — the same way you'd gate on unit test
pass/fail — is the practical bridge between "we tested this once manually" and
"this is systematically verified on every change," and is a documented pattern
used to gate production deploys behind a required pass-rate threshold across a
large test-case suite.

## Practical guidance

1. **Instrument with `logfire.instrument_pydantic_ai()` from day one**, even in
   development — retrofitting observability after a production incident is much
   harder than having traces already available.
2. **You're not locked into Logfire's SaaS** — the underlying OTel spans work with
   any compatible backend if your organization already has one.
3. **Watch validation retry counts specifically** — this is a direct, actionable
   signal about `output_type` schema or system-prompt quality, not just noise.
4. **Build a Pydantic Evals dataset early**, even a small one — a handful of
   representative cases with clear pass/fail criteria catches regressions that
   manual spot-checking misses.
5. **Use `LLMJudge` for genuinely open-ended output quality**, and gate CI/deploys
   on eval pass rate once you have enough cases to trust the signal.