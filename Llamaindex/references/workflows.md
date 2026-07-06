# Workflows — Event-Driven Orchestration

## What is a Workflow?

An event-driven, step-based way to control execution flow. Your application is divided
into **Steps** (Python functions/methods) triggered by **Events**, which themselves emit
further Events that trigger more steps. This replaces brittle DAG-based orchestration
with plain, flexible Python.

```bash
pip install llama-index-workflows
# (llama-index-core already bundles this; import via llama_index.core.workflow)
```

**Why not DAGs?** Loops and branches in a DAG must be encoded into edges, which is hard
to read. Passing data between DAG nodes creates messy optional-parameter complexity.
Workflows solve both with an event-driven, plain-Python approach.

## Minimal workflow example

```python
from workflows import Workflow, step
from workflows.events import Event, StartEvent, StopEvent
from llama_index.llms.openai import OpenAI

class JokeEvent(Event):
    joke: str

class JokeFlow(Workflow):
    llm = OpenAI(model="gpt-4.1")

    @step
    async def generate_joke(self, ev: StartEvent) -> JokeEvent:
        topic = ev.topic
        response = await self.llm.acomplete(f"Write your best joke about {topic}.")
        return JokeEvent(joke=str(response))

    @step
    async def critique_joke(self, ev: JokeEvent) -> StopEvent:
        response = await self.llm.acomplete(f"Critique this joke: {ev.joke}")
        return StopEvent(result=str(response))

w = JokeFlow(timeout=60, verbose=False)
result = await w.run(topic="pirates")
print(str(result))
```

**Key mechanics:**
- `StartEvent` and `StopEvent` are special built-in events marking entry/exit
- `StartEvent` holds arbitrary attributes (`ev.topic` here) passed as kwargs to `.run()`
- The `@step` decorator infers each step's input/output event types from type hints —
  this is how the workflow knows which step handles which event, and it validates the
  full graph before running
- Returning `StopEvent(result=...)` immediately ends the workflow

## Branches and loops

Steps can emit different event types conditionally, creating branches; a step can also
emit an event type that an earlier step consumes, creating a loop.

```python
from workflows.events import Event

class RetryEvent(Event):
    attempt: int

class QualityCheckFlow(Workflow):
    @step
    async def generate(self, ev: StartEvent | RetryEvent) -> StopEvent | RetryEvent:
        attempt = getattr(ev, "attempt", 0)
        result = await self.llm.acomplete(f"Attempt {attempt}: generate something")
        if "good enough" in str(result) or attempt >= 3:
            return StopEvent(result=str(result))
        return RetryEvent(attempt=attempt + 1)   # Loop back to self
```

A step accepting a union type (`StartEvent | RetryEvent`) can handle either trigger —
this is how loops are expressed naturally in plain Python.

## Managing state — the Context object

For data that needs to persist or be shared across steps without passing it through every
event:

```python
from workflows import Context

class StatefulFlow(Workflow):
    @step
    async def step_one(self, ctx: Context, ev: StartEvent) -> ProcessEvent:
        async with ctx.store.edit_state() as state:
            state["accumulated_data"] = []
        return ProcessEvent(item=ev.item)

    @step
    async def step_two(self, ctx: Context, ev: ProcessEvent) -> StopEvent:
        async with ctx.store.edit_state() as state:
            state["accumulated_data"].append(ev.item)
        return StopEvent(result=state["accumulated_data"])
```

Every step can optionally receive a `ctx: Context` parameter — the workflow engine injects
it automatically.

## Streaming events

Stream intermediate progress/events to the caller (e.g., for a chat UI):

```python
class StreamingFlow(Workflow):
    @step
    async def process(self, ctx: Context, ev: StartEvent) -> StopEvent:
        ctx.write_event_to_stream(Event(msg="Starting processing..."))
        result = await do_work()
        ctx.write_event_to_stream(Event(msg="Processing complete"))
        return StopEvent(result=result)

handler = w.run(topic="pirates")
async for event in handler.stream_events():
    print(event)
result = await handler
```

## Concurrent execution of steps

```python
class ParallelFlow(Workflow):
    @step
    async def dispatch(self, ctx: Context, ev: StartEvent) -> None:
        # Send multiple events to run in parallel
        for item in ev.items:
            ctx.send_event(ProcessItemEvent(item=item))

    @step(num_workers=4)   # Run up to 4 instances of this step concurrently
    async def process_item(self, ev: ProcessItemEvent) -> ResultEvent:
        result = await expensive_operation(ev.item)
        return ResultEvent(result=result)

    @step
    async def collect(self, ctx: Context, ev: ResultEvent) -> StopEvent:
        results = ctx.collect_events(ev, expected=[ResultEvent] * 10)
        if results is None:
            return None    # Not all results in yet, wait for more
        return StopEvent(result=results)
```

`ctx.collect_events` is the standard fan-out/fan-in pattern — dispatch N events, wait
until all N corresponding results arrive, then proceed.

## Human in the loop in Workflows

```python
from workflows.events import InputRequiredEvent, HumanResponseEvent

class ApprovalFlow(Workflow):
    @step
    async def request_approval(self, ctx: Context, ev: StartEvent) -> StopEvent:
        ctx.write_event_to_stream(
            InputRequiredEvent(prefix="Approve this action? (yes/no): ")
        )
        response = await ctx.wait_for_event(HumanResponseEvent)
        if response.response.lower() == "yes":
            return StopEvent(result="Approved and executed")
        return StopEvent(result="Rejected")
```

The workflow pauses at `wait_for_event` until the external caller sends a
`HumanResponseEvent` back in.

## Error handling & retries

```python
from workflows.retry_policy import ConstantDelayRetryPolicy

class RobustFlow(Workflow):
    @step(retry_policy=ConstantDelayRetryPolicy(delay=2, maximum_attempts=3))
    async def flaky_step(self, ev: StartEvent) -> StopEvent:
        result = await call_unreliable_api()
        return StopEvent(result=result)
```

## Custom start/stop events (type safety)

```python
class MyStartEvent(StartEvent):
    topic: str
    max_length: int = 100

class MyStopEvent(StopEvent):
    summary: str
    word_count: int

class TypedFlow(Workflow):
    @step
    async def run_step(self, ev: MyStartEvent) -> MyStopEvent:
        ...
```

Subclassing gives you IDE autocomplete and validation instead of loosely-typed `ev.topic`.

## Drawing a workflow (visualize the graph)

```python
from workflows.utils import draw_all_possible_flows
draw_all_possible_flows(JokeFlow, filename="joke_flow.html")
```

Generates an HTML visualization of all possible step→event transitions — useful for
debugging complex workflows.

## Observability

```python
from llama_index.core import set_global_handler
set_global_handler("arize_phoenix")   # or "wandb", "langfuse", "simple"
```

Workflows automatically emit step-start/step-end spans compatible with most LLM
observability platforms.

## Deploying workflows — llamactl / llama_deploy

Workflows can be deployed as standalone production microservices via `llamactl`:

```bash
pip install llamactl
llamactl init my-workflow-deployment
llamactl serve
```

This exposes your `Workflow` class over an HTTP API with a built-in UI, suitable for
production multi-agent and RAG deployments. See
`developers.llamaindex.ai/python/llamaagents/llamactl/getting-started/`.

## When to use Workflows vs. FunctionAgent/AgentWorkflow

| Need | Use |
|---|---|
| Simple single agent with tools | `FunctionAgent` |
| Multiple agents handing off to each other | `AgentWorkflow` |
| Custom control flow: branching, loops, parallel fan-out, human approval gates, deterministic + agentic steps mixed | Custom `Workflow` |
| Corrective RAG, query planning, reflection loops | Custom `Workflow` (these inherently need conditional branches) |

`FunctionAgent` and `AgentWorkflow` are themselves built using the Workflow primitives
under the hood — Workflows are the foundational layer for everything agentic in LlamaIndex.