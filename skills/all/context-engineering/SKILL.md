---
name: context-engineering
description: >
  Complete manual for context engineering — the emerging discipline (distinct
  from prompt engineering) of managing what an AI agent sees, remembers, and
  attends to at each step of a long-running task. Use whenever the user asks
  about context engineering, agent context window management, context rot,
  context compaction/summarization, sub-agent context isolation, memory
  hierarchies for agents, the write/select/compress/isolate framework, tool
  result clearing, scratchpads, CLAUDE.md/AGENTS.md memory files, why a long
  agent conversation degrades or "forgets" things, or how to design context
  flow for a multi-step or multi-agent system. Also trigger for beginner
  questions like what context engineering is, how it differs from prompt
  engineering, or why bigger context windows don't solve long-running-agent
  reliability on their own.
---

# The Context Engineering Manual

You are acting as an expert agent architect specializing in context
engineering — a discipline that only became a named, distinct practice in
2025-2026 as agents moved from single-turn chat to long-running, multi-step,
multi-agent work. This skill sits one layer beneath everything else in this
collection's agent-building skills (LangChain, Pydantic AI, MCP): those skills
tell you how to build an agent's *capabilities*; this skill tells you how to
manage what that agent actually *sees* at each step, which is what determines
whether a long-running agent stays reliable or quietly degrades.

## Context engineering vs. prompt engineering — the distinction that matters

> **Prompt engineering answers "how do I ask?" Context engineering answers
> "what does the agent know, see, and remember at the moment of action?"**

A prompt is a single instruction. **Context is the entire informational
environment the instruction executes in**: memory, prior tool outputs,
conversation history, retrieved documents, sub-agent visibility boundaries,
and system constraints — accumulated across every step of a trajectory, not
just the current turn. Prompt engineering optimizes one message. Context
engineering treats the context window itself as a **finite, actively-managed
resource** across an entire multi-step, possibly multi-hour or multi-day
agent run. Andrej Karpathy's framing, widely repeated in the field: think of
the LLM as a CPU and its context window as RAM — a working memory that must
be actively managed, not an unlimited scratch space.

## Context rot — the problem this discipline exists to solve

**Context rot**: LLM accuracy degrades as context length grows, **even when
all relevant information remains present and technically fits the window** —
this is not a capacity problem alone; it's an attention problem, with
documented degradations ranging from roughly 14% to 85% depending on the task
and how the context is structured. This is why shipping a bigger context
window doesn't solve long-running-agent reliability on its own: Anthropic's
1M-token context window reduced compaction *events* by 15% in real Claude
Code usage, but token cost still scales with context size, and — critically —
**a full context window is still a failure mode you actively design against,
not a target to fill.** Context is a resource with diminishing and eventually
negative marginal returns, not a bucket to top off.

## The four core strategies — Write, Select, Compress, Isolate

This framework (LangChain's naming, but the underlying strategies are
framework-agnostic — they apply equally to LangGraph, the Claude Agent SDK,
OpenAI's Agents SDK, CrewAI, or a raw API loop) organizes every context
engineering technique into four buckets:

| Strategy | What it means | Example techniques |
|---|---|---|
| **Write** | Save information *outside* the context window so it's available later without occupying working memory now | Scratchpads, plan files, persistent memory (CLAUDE.md/AGENTS.md) |
| **Select** | Pull only the relevant information *into* the context window, on demand — not everything upfront | RAG-style retrieval, tool-result references instead of full payloads, on-demand file reads |
| **Compress** | Retain only the tokens actually needed to continue the task | Summarization/compaction, tool-result clearing, trimming old messages |
| **Isolate** | Split context across separate agents/scopes so each sees only what its subtask needs | Sub-agents with fresh context, scoped state fields, per-role memory |

Every technique covered in this skill's reference files is an instance of one
(or a combination) of these four — internalizing this taxonomy is what turns
context engineering from a grab-bag of tricks into a design discipline you
can apply systematically to a new agent.

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Context rot in depth: why it happens, the research, and how to recognize it in your own agent | `references/context_rot.md` |
| Write strategies: scratchpads, plan files, CLAUDE.md/AGENTS.md persistent memory, memory hierarchies | `references/write_strategies.md` |
| Select strategies: on-demand retrieval, tool-result references vs. inline results, scoped tool exposure | `references/select_strategies.md` |
| Compress strategies: compaction/summarization mechanics, tool-result clearing, provider-specific compaction (Claude, OpenAI) | `references/compress_strategies.md` |
| Isolate strategies: sub-agent context isolation, the three multi-agent compaction patterns, token budget allocation | `references/isolate_strategies.md` |
| Implementation patterns: a full worked example, LangGraph state-based context control, Claude Agent SDK hooks | `references/implementation_patterns.md` |
| Measuring and debugging context: token budget tables, diagnosing which context problem you actually have, observability | `references/measuring_and_debugging.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **Treat context as a scarce resource from the start of agent design**, not
   an afterthought bolted on once an agent starts misbehaving on long
   conversations — the four strategies are design inputs, not just
   debugging tools.
2. **Scope by default: every model call and sub-agent should see the minimum
   context required for its specific step**, not the maximum available —
   agents must reach for more information explicitly (via a tool call), not
   be flooded with everything by default. This is Google's ADK's framing, and
   it generalizes beyond that specific framework.
3. **Separate durable state from the per-call view built from it** — what an
   agent has learned/decided over a session (durable) is a different concern
   from what's actually assembled into the prompt for the *next* single call
   (the view) — conflating the two makes context flow impossible to reason
   about or test.
4. **Isolation (sub-agents with fresh context) is consistently the highest-
   leverage lever at scale** — Anthropic's own multi-agent research system
   found token usage explains roughly 80% of performance variance on a
   difficult benchmark, more than model choice or tool-call count. Reach for
   sub-agent isolation before assuming a bigger model or a cleverer single
   prompt will fix a long-running agent's reliability problems.
5. **Persistent memory files (CLAUDE.md/AGENTS.md-style) are for rules that
   must survive compaction** — anything critical enough that losing it to a
   summarization pass would break the agent's behavior belongs there, not
   only in the conversation history where compaction can erode it.
6. **Never treat a full context window as a neutral, "we have room" state** —
   context rot means quality can already be degrading well before the window
   is technically full; monitor and act before hitting the limit, not at it.
7. **Context engineering strategies compose with cost optimization** — see
   this collection's `llm-cost-optimization` skill: compression and
   compaction reduce token spend as a direct side effect of improving
   reliability, and prompt-caching-friendly structure (static content first)
   is itself a context engineering discipline, not a separate concern.
8. **Source of truth: this field is moving fast and is genuinely new** — most
   of the concrete numbers and named techniques here (compaction thresholds,
   token budget tables, provider-specific compaction mechanics) come from
   Anthropic's and LangChain's engineering blogs and cookbooks, published
   through 2025-2026. Web-search current documentation before citing a
   specific number or API, since this is one of the fastest-evolving areas
   in the whole agent ecosystem.