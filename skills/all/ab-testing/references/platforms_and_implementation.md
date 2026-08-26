# Experimentation Platforms — GrowthBook, Statsig, Eppo, and DIY

## The current platform landscape (2026)

The market has consolidated significantly through 2025-2026 acquisitions —
worth knowing about explicitly since it affects build-vs-buy decisions:

| Platform | Model | Notable 2026 context |
|---|---|---|
| **GrowthBook** | Open-source, self-hostable, warehouse-native | The default recommendation for engineering-led teams wanting full data control and no platform lock-in; free self-hosted tier covers most of what paid platforms offer for technically capable teams |
| **Statsig** | Cloud-only SaaS, all-in-one (flags + experimentation + analytics) | **Acquired by OpenAI in 2025** — evaluate platform-longevity and data-governance risk before committing here for a new project; no published policy separating customer experimentation data from OpenAI's own AI training |
| **Eppo** | Warehouse-native, strong statistical rigor | **Acquired by Datadog in 2025**, now "Datadog Experiments" — the strategic fit is strongest for teams already operating in the Datadog ecosystem (logs, traces, APM), since it lets you connect experiment results directly to service health signals |
| **LaunchDarkly** | Feature-flag-first, experimentation as an add-on | Best when feature flagging/progressive delivery is the primary need and experimentation is secondary |
| **PostHog** | Open-source, self-hosted, analytics + experimentation combined | Fits early-stage teams wanting to consolidate analytics and experimentation in one tool before a dedicated data-warehouse strategy exists |

**Given the acquisition activity, evaluate platform stability as a real input
to the decision**, not just feature comparison — a platform acquired by a
company whose core business is different from experimentation infrastructure
carries real roadmap and data-governance uncertainty worth factoring in,
especially for anything handling sensitive product/user data.

## Warehouse-native vs. event-ingestion architectures

**Warehouse-native** platforms (GrowthBook, Eppo/Datadog) run experiment
analysis directly against your existing data warehouse (Snowflake, BigQuery,
etc.) rather than requiring you to duplicate all your event data into a
separate proprietary store. **Event-ingestion** platforms (Statsig, most
all-in-one SaaS tools) require sending events to their own infrastructure.

**Warehouse-native is the stronger fit** for organizations with mature data
engineering practices and existing warehouse infrastructure — it avoids data
duplication costs, keeps PII inside your own governance boundary, and lets
experiment results join naturally against your other business data. Event-
ingestion SaaS tools have a lower initial integration barrier and often a
more generous free tier — a reasonable fit for earlier-stage teams without
existing warehouse infrastructure, at the cost of duplicating data into a
third party's systems.

## Building your own — a legitimate option for smaller-scale needs

You don't need a dedicated platform to run statistically valid experiments —
the actual requirements are: consistent variant assignment, event logging,
and correct statistical analysis, all of which are straightforward to
implement directly:

```python
import hashlib

def assign_variant(user_id: str, experiment_name: str, variants: list[str], weights: list[float] = None) -> str:
    """Deterministic, stable variant assignment — the same user+experiment
    combination always yields the same variant."""
    hash_input = f"{experiment_name}:{user_id}".encode()
    hash_value = int(hashlib.sha256(hash_input).hexdigest(), 16)
    bucket = (hash_value % 10000) / 10000.0   # a stable float in [0, 1)

    if weights is None:
        weights = [1.0 / len(variants)] * len(variants)
    cumulative = 0.0
    for variant, weight in zip(variants, weights):
        cumulative += weight
        if bucket < cumulative:
            return variant
    return variants[-1]
```

```python
# Logging — plain event rows, analyzed later with standard SQL/pandas/scipy
def log_experiment_exposure(user_id: str, experiment_name: str, variant: str, timestamp):
    db.execute(
        "INSERT INTO experiment_exposures (user_id, experiment_name, variant, exposed_at) VALUES (%s, %s, %s, %s)",
        (user_id, experiment_name, variant, timestamp),
    )
```

```sql
-- Analysis: join exposures against your existing outcome/event tables in plain SQL
SELECT
    e.variant,
    COUNT(DISTINCT e.user_id) AS users,
    COUNT(DISTINCT o.user_id) AS converted_users,
    COUNT(DISTINCT o.user_id)::float / COUNT(DISTINCT e.user_id) AS conversion_rate
FROM experiment_exposures e
LEFT JOIN outcome_events o
    ON e.user_id = o.user_id AND o.event_time > e.exposed_at
WHERE e.experiment_name = 'new_checkout_flow'
GROUP BY e.variant;
```

**A DIY approach is entirely reasonable** for a small number of experiments,
a team with real SQL/statistics capability, or a warehouse-centric data stack
already in place (see this collection's `postgresql-architect` and
`mongodb-architect` skills for the underlying database work this builds on)
— the statistical methods in `statistical_analysis.md` and
`advanced_techniques.md` apply identically whether computed via a platform's
UI or a Python/SQL script you wrote yourself. **Reach for a dedicated
platform once** you're running many concurrent experiments (avoiding
collisions/interactions between them becomes a real coordination problem), need
non-technical stakeholders to configure and read experiments without
engineering involvement, or need built-in sequential testing / CUPED without
implementing the statistics yourself.

## MCP and AI-native experimentation workflows

Some platforms now expose experimentation directly to AI coding tools —
GrowthBook, for instance, has an MCP server integration letting you create
flags, launch experiments, and query results from within an AI-assisted
development workflow (see this collection's `mcp-architect` skill for the
underlying protocol) rather than only through a web UI — a sign that
experimentation tooling itself is becoming an integration point for
agentic/AI-assisted engineering workflows, not just a target for testing
*other* AI products.

## Practical guidance

1. **Weigh platform stability/ownership as a real input**, not just a feature
   checklist — the 2025 acquisition wave changed the risk profile of several
   major platforms.
2. **Prefer warehouse-native platforms if you already have mature warehouse
   infrastructure** — avoids data duplication and keeps governance simpler.
3. **DIY is legitimate for smaller-scale, technically capable teams** — the
   statistical rigor comes from correctly applying the methods in this skill,
   not from which specific platform runs the computation.
4. **Move to a dedicated platform once experiment volume or stakeholder
   involvement outgrows what a DIY script can comfortably support.**