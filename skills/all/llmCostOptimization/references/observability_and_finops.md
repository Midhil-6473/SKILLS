# Cost Observability and FinOps — LiteLLM, Langfuse, and the Three-Layer Stack

## You cannot optimize what you can't measure

Every lever in this skill assumes you know your current cost breakdown —
by model, by feature, by user, by request type. Without that, "optimize our
AI costs" has no concrete starting point. **Instrumentation comes before
optimization**, always — this is the first best practice in `SKILL.md` for a
reason.

## The three-layer tool stack

The field has converged on a fairly consistent three-layer model, worth
understanding before choosing tools rather than picking one tool and hoping
it covers everything:

```
Layer 1: Gateway/Proxy — real-time budget enforcement and routing
  Tools: LiteLLM, Portkey, OpenRouter
  Job: enforce spend limits BEFORE tokens are spent, unify multi-provider
       access, apply routing/fallback logic

Layer 2: Observability/Tracing — trace-level cost attribution and debugging
  Tools: Langfuse (self-hosted, open-source), LangSmith (LangChain-native),
         Braintrust (eval-focused), Datadog (enterprise APM-integrated)
  Job: attribute cost to specific users/features/requests AFTER the fact,
       for debugging and analysis

Layer 3: FinOps — budgets, chargeback, anomaly detection, forecasting
  Tools: CloudZero and similar, once spend/org size justify a dedicated layer
  Job: turn raw cost data into organizational accountability — budgets,
       cross-team chargeback, spend forecasting, anomaly alerts
```

**Provider dashboards (OpenAI's Usage page, the Anthropic Console) are a
sanity check, never a primary tool** — they show aggregate spend only, with
no per-user or per-feature attribution, which is exactly the granularity you
need to actually act on cost data.

## LiteLLM — the standard open-source gateway

```python
import litellm

# A single unified interface across 100+ providers — OpenAI, Anthropic,
# Bedrock, Azure, Vertex AI, and more — using an OpenAI-compatible format
response = litellm.completion(
    model="anthropic/claude-sonnet-4-6",   # or "openai/gpt-5.5", "bedrock/...", etc.
    messages=[{"role": "user", "content": "Hello"}],
)
```

```yaml
# Running LiteLLM as a proxy server gives budget enforcement, virtual keys,
# and routing/fallback as centralized, cross-team infrastructure
model_list:
  - model_name: gpt-5.5
    litellm_params:
      model: openai/gpt-5.5
      api_key: os.environ/OPENAI_API_KEY

router_settings:
  routing_strategy: usage-based-routing   # or latency-based, cost-based

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```python
# Budget enforcement at multiple levels — org, team, project, user, or API key
import requests

requests.post(
    "http://localhost:4000/key/generate",
    json={"max_budget": 100.0, "budget_duration": "30d", "user_id": "user_123"},
    headers={"Authorization": f"Bearer {master_key}"},
)
```

LiteLLM's budget model is **hierarchical**: constraints at a higher level
(organization) act as a global ceiling, while lower-level constraints (a
specific API key) provide granular per-application or per-user control. It
supports both **hard limits** (block requests once a budget is exhausted) and
**soft limits** (alert without blocking) — choose hard limits for genuine
cost-containment requirements, soft limits where you want visibility without
risking a service outage from an abrupt cutoff.

## Langfuse — open-source cost observability and tracing

```python
from langfuse.openai import openai   # drop-in wrapper capturing cost/usage automatically

client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{"role": "user", "content": "Hello"}],
)
# Token usage, cost, and latency are automatically captured and attributed
# to this specific trace in the Langfuse dashboard
```

Langfuse can ingest cost data either **directly** (when a gateway like
LiteLLM or OpenRouter already returns cost figures in its response) or
**inferred** (computed from the model name and token counts against
Langfuse's own maintained price table, for providers that don't return cost
directly) — useful to know when cost figures look unexpected, since an
inferred cost is only as accurate as Langfuse's price table is current for
that specific model.

## Choosing based on the question you're actually asking

**"Best LLM cost tracking tool" has no single answer — it depends on the
specific question you're trying to answer**:

| Question | Reach for |
|---|---|
| "Stop spend from exceeding X in real time" | A gateway (Layer 1) — LiteLLM, Portkey |
| "Which feature/user is driving this cost, and why" | Observability (Layer 2) — Langfuse, LangSmith |
| "What's our AI budget forecast, and who's accountable" | FinOps (Layer 3) — once scale justifies it |
| "Is our LangChain-based agent's cost broken down by chain step" | LangSmith specifically, if already LangChain-native |
| "We're doing structured evals and want cost tied to eval results" | Braintrust |

Most teams don't need all three layers on day one — start with a gateway for
budget safety and basic tracking, add dedicated observability once you need
finer-grained attribution, and add a FinOps layer only once organizational
scale (multiple teams, chargeback requirements, board-level spend reporting)
actually justifies it.

## Setting up basic cost alerting

```python
# A simple daily spend-anomaly check, regardless of which specific tool
# stack you're using underneath
def check_spend_anomaly(today_spend: float, trailing_7day_avg: float, threshold: float = 1.5):
    if today_spend > trailing_7day_avg * threshold:
        alert(f"Spend anomaly: today ${today_spend:.2f} vs. 7-day avg ${trailing_7day_avg:.2f}")
```

A spend spike is often the fastest, cheapest signal that something has gone
wrong — a cache-hit-rate regression (`prompt_caching.md`), a routing
misconfiguration sending traffic to the wrong tier, or a runaway agent loop
(`agentic_and_rag_costs.md`) all show up first as an anomalous spend curve,
often before any other monitoring catches the underlying cause.

## Practical guidance

1. **Instrument before optimizing** — know your cost breakdown by model,
   feature, and user before touching any of the levers elsewhere in this
   skill.
2. **Use the three-layer framework to choose tools deliberately** — a
   gateway for real-time control, observability for attribution/debugging, a
   FinOps layer only once organizational scale justifies it.
3. **Never rely on provider dashboards as your primary cost tool** — they
   lack the per-user/per-feature granularity needed to act on the data.
4. **Set up spend-anomaly alerting early** — it's often the fastest signal
   that a cache regression, routing bug, or runaway agent loop has occurred.
5. **Match hard vs. soft budget limits to actual risk tolerance** — hard
   limits for genuine cost-containment needs, soft limits where an abrupt
   cutoff would be worse than the overage itself.