# Write Strategies — Scratchpads, Plan Files, Persistent Memory

## The core idea

**Writing context means saving information *outside* the active context
window**, so it's available later without occupying working memory right
now. The human analogy: you take notes rather than trying to hold every
detail of a long task in your head simultaneously — the notes exist, but
they're not all "in your head" (in context) at every moment, only when you
actually consult them.

## Scratchpads — note-taking during a task

```python
# A scratchpad is simply state persisted OUTSIDE the LLM's active context,
# that the agent can write to and later read back selectively
class ContextScratchpad:
    def __init__(self):
        self._notes: dict[str, str] = {}

    def write(self, key: str, content: str) -> None:
        self._notes[key] = content   # saved, but NOT automatically in context

    def read(self, key: str) -> str | None:
        return self._notes.get(key)   # pulled into context only when explicitly needed
```

In LangGraph, this maps directly onto the **state object** — a `StateGraph`
schema lets you store tool-call results or intermediate findings in specific
state fields, isolating them from the LLM's active context until (and
unless) a later step explicitly needs them. The information exists in your
system; it doesn't automatically cost context tokens on every subsequent
call.

## Plan files — for long-running, multi-step tasks

For agents doing genuinely long, multi-step work (research, complex
multi-file coding tasks), a common pattern is a small set of purpose-specific
files instead of one growing conversation:

```
plan.md            — the question/goal, research dimensions, completed work, remaining work
research_notes.md  — claims, evidence, and contradictions found so far
sources.json        — citation metadata
open_questions.md   — unfinished/unresolved threads, made explicit rather than left implicit
```

**The key property this gives you**: the *current decision* stays in the
active conversation, while *everything that doesn't need to be active right
now* — the full research history, all sources consulted, the complete plan —
lives in files the agent can read back selectively via a tool call, rather
than being permanently resident in context. This is precisely what lets an
agent work continuously across hours or even days without the accumulated
history itself becoming the bottleneck.

## Persistent memory files — CLAUDE.md / AGENTS.md

```markdown
# AGENTS.md (or CLAUDE.md — the naming varies by host, the pattern is the same)

## Project conventions
- All API responses use snake_case, not camelCase
- Tests go in tests/, mirroring the source file structure
- Never modify files in vendor/ directly

## Critical constraints
- The production database migration script must NEVER run automatically
- All customer-facing copy must be reviewed before merging
```

**AGENTS.md has become a de facto universal standard** across major coding
agent hosts (Claude Code, Codex, Cursor, Aider, Copilot, Gemini CLI,
Windsurf) specifically because it solves a problem compaction alone can't:
**rules and conventions that must survive summarization**. A standard
conversation-history compaction pass (see `compress_strategies.md`)
summarizes based on what seems important in the moment — a persistent memory
file is **re-injected into the system prompt on every turn, regardless of
what compaction does to the rest of the conversation**, guaranteeing that
critical, static rules never silently erode.

**What belongs in a persistent memory file, vs. what doesn't**: durable
project conventions, hard constraints, and user preferences that should
apply to *every* interaction — not task-specific findings or session-specific
state, which belong in scratchpads/plan files instead. Putting rapidly-changing
information in a persistent memory file bloats the system prompt on every
single turn for content that's only relevant sometimes; the write/select
distinction (see `select_strategies.md`) is exactly the discipline that keeps
this separation correct.

## Memory hierarchies — combining write strategies deliberately

A mature agent's context typically draws from several distinct write-strategy
sources simultaneously, each with a different lifetime and re-injection
pattern:

```
Persistent memory (AGENTS.md-style)  → every turn, regardless of compaction
Long-term memory (a durable store)    → loaded when relevant to the current task
Session scratchpad/plan files         → read back explicitly via tool calls
Active conversation                    → the current turn's live working memory
```

**Treat these as genuinely separate storage tiers with separate rules**, not
one undifferentiated pile of "stuff the agent knows" — this is what Google's
ADK calls "separating storage from presentation": durable state (what's
actually saved) and the per-call view (what's actually assembled into a given
prompt) are different concerns that should be allowed to evolve
independently, not conflated into one growing conversation history.

## Practical guidance

1. **Use scratchpads/state fields for anything that doesn't need to be in
   the LLM's active attention on every single step** — write it out, read it
   back only when actually needed.
2. **Use plan/notes files (not just conversation history) for genuinely
   long-running, multi-step tasks** — this is what makes multi-hour or
   multi-day agent work tractable at all.
3. **Reserve persistent memory files (AGENTS.md/CLAUDE.md) specifically for
   rules that must survive compaction** — durable conventions and hard
   constraints, not session-specific findings.
4. **Treat memory as a hierarchy with distinct tiers**, each with its own
   lifetime and re-injection rule — don't let everything the agent "knows"
   collapse into one undifferentiated, ever-growing conversation.