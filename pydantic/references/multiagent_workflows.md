# Multi-Agent Workflows and `pydantic-graph`

## An honest starting point: Pydantic AI's multi-agent story is basic

Unlike LangGraph (explicit stateful graphs with cycles and checkpointing) or CrewAI
(role-based multi-agent primitives with autonomous delegation as a first-class
concept), **Pydantic AI does not ship built-in agent-handoff or role-based
multi-agent primitives**. There's no equivalent of CrewAI's `Crew`/roles/goals
system, and no OpenAI-Agents-SDK-style built-in handoff list between agents. If
your architecture specifically depends on that pattern, this is currently a real
limitation to know about upfront, not something to discover after building around
it.

**What Pydantic AI does provide** for multi-step/multi-agent needs: manual agent
delegation (one agent's tool calls another agent), and `pydantic-graph` for
building explicit, typed state machines when you need real control flow.

## Pattern 1: Manual agent delegation

The simplest multi-agent pattern — one agent's tool function runs a second agent
internally.

```python
from pydantic_ai import Agent, RunContext
from dataclasses import dataclass

research_agent = Agent(
    "claude-sonnet-4-6",
    system_prompt="You are a research specialist. Find and summarize relevant facts.",
)

@dataclass
class WriterDeps:
    pass

writer_agent = Agent(
    "claude-sonnet-4-6",
    deps_type=WriterDeps,
    system_prompt="You are a writing specialist. Draft polished content from research notes.",
)

@writer_agent.tool
async def get_research(ctx: RunContext[WriterDeps], topic: str) -> str:
    """Delegate research on a topic to the research specialist."""
    result = await research_agent.run(f"Research: {topic}")
    return result.output

final_result = writer_agent.run_sync("Write a short article about the history of Python")
```

This is straightforward, fully type-safe, and sufficient for many real
"specialist calls specialist" workflows — but it's manual delegation via a tool
call, not a first-class "handoff" abstraction with its own primitives.

## Pattern 2: `pydantic-graph` — typed state machines for real control flow

For workflows needing explicit branching, loops, or persistent state across
multiple steps (not just "agent A calls agent B once"), `pydantic-graph` provides
a typed, finite-state-machine-style graph — conceptually similar to LangGraph, but
staying close to plain Python with full static type checking.

```python
from dataclasses import dataclass
from pydantic_graph import BaseNode, End, Graph, GraphRunContext

@dataclass
class ResearchState:
    topic: str
    research_notes: str = ""
    draft: str = ""

@dataclass
class Research(BaseNode[ResearchState]):
    async def run(self, ctx: GraphRunContext[ResearchState]) -> "Write":
        result = await research_agent.run(f"Research: {ctx.state.topic}")
        ctx.state.research_notes = result.output
        return Write()

@dataclass
class Write(BaseNode[ResearchState]):
    async def run(self, ctx: GraphRunContext[ResearchState]) -> "Review":
        result = await writer_agent.run(
            f"Write an article using these notes: {ctx.state.research_notes}"
        )
        ctx.state.draft = result.output
        return Review()

@dataclass
class Review(BaseNode[ResearchState]):
    async def run(self, ctx: GraphRunContext[ResearchState]) -> End[str] | Write:
        if "needs revision" in ctx.state.draft.lower():
            return Write()   # loop back for another draft pass
        return End(ctx.state.draft)

graph = Graph(nodes=[Research, Write, Review])
result = await graph.run(Research(), state=ResearchState(topic="the history of Python"))
print(result.output)
```

Each node is a typed dataclass with a `run` method returning the next node (or
`End`) — the graph's possible transitions are statically checkable from the return
type annotations, giving you real IDE support and type-checker validation of your
control flow, similar in spirit to LangGraph's typed state but expressed as plain
Python classes rather than a separate graph-building DSL.

## When to reach for `pydantic-graph` vs. LangGraph

| | `pydantic-graph` | LangGraph |
|---|---|---|
| **Maturity** | Newer, part of the Pydantic AI ecosystem | Mature, in production since early 2024, now v1.0 |
| **Style** | Plain Python dataclasses/typed nodes | Purpose-built graph-building API (`StateGraph`, `add_node`, `add_edge`) |
| **Checkpointing/persistence** | Available, less battle-tested | Mature — `InMemorySaver`, Postgres, etc., widely used in production |
| **Ecosystem** | Tied to Pydantic AI | Deep integration with LangChain's 600+ integrations, LangSmith |
| **Best for** | Teams already using Pydantic AI wanting typed control flow without adding a second framework | Complex, cyclic, production multi-agent systems needing mature checkpointing/persistence and the broader LangChain ecosystem |

**The honest, commonly-repeated 2026 guidance**: LangGraph remains the stronger
choice specifically for **complex, stateful, multi-agent graphs with conditional
routing** — it's more mature, more battle-tested in production, and has richer
persistence/checkpointing. `pydantic-graph` is a good fit when you're already
committed to Pydantic AI for its type safety and don't want to introduce a second
framework's concepts just for moderate control-flow needs.

## Using Pydantic AI *inside* a LangGraph node — a valid hybrid pattern

```python
from pydantic_ai import Agent
from pydantic import BaseModel
from langgraph.graph import StateGraph, MessagesState, START, END

class AnalysisResult(BaseModel):
    summary: str
    action_items: list[str]

analyst_agent = Agent("claude-sonnet-4-6", output_type=AnalysisResult)

async def analyze_node(state: MessagesState) -> dict:
    last_message = state["messages"][-1].content
    result = await analyst_agent.run(last_message)
    return {"messages": [{"role": "assistant", "content": result.output.summary}]}

graph = (
    StateGraph(MessagesState)
    .add_node("analyze", analyze_node)
    .add_edge(START, "analyze")
    .add_edge("analyze", END)
    .compile()
)
```

This combines Pydantic AI's type-safe structured output for the *reasoning* inside
a single step with LangGraph's mature graph orchestration for the overall
*control flow* — a genuinely common, sensible pattern rather than an either/or
choice. Use Pydantic AI where you want guaranteed-typed output from a specific
LLM call, inside a LangGraph node/step that handles the surrounding orchestration.

## Practical guidance

1. **Know the limitation upfront**: Pydantic AI has no built-in role-based
   multi-agent or handoff-list primitives — plan around manual delegation or
   `pydantic-graph` instead, or reach for LangGraph/CrewAI if your architecture
   specifically needs those patterns as first-class citizens.
2. **Use manual delegation (Pattern 1)** for simple "specialist calls specialist"
   needs — it's type-safe and sufficient for many real cases.
3. **Use `pydantic-graph`** when you need explicit branching/loops/state but want
   to stay within the Pydantic AI ecosystem and its plain-Python style.
4. **Use LangGraph** for genuinely complex, cyclic, production multi-agent systems
   needing mature checkpointing — this remains the stronger choice for that
   specific need as of 2026.
5. **Consider the hybrid pattern** (Pydantic AI inside LangGraph nodes) rather than
   treating framework choice as strictly either/or.