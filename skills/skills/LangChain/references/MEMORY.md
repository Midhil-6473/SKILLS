# Memory — Reference

LangChain distinguishes two fundamentally different kinds of memory. Always
clarify which one the user actually needs before writing code.

| | Short-term memory | Long-term memory |
|---|---|---|
| Scope | A single thread/conversation | Across threads, sessions, users |
| Lives in | Graph **state** | A **store** (`BaseStore`) |
| Persisted by | A **checkpointer** | The store itself (in-memory or DB-backed) |
| Typical use | Conversation history, scratch state mid-task | User preferences, facts learned about a user, episodic/semantic memories |

## Short-term memory

Agents track conversation history automatically in the message list inside
their state. You can extend that state to remember additional structured
information across turns of the *same* thread.

Two ways to add custom state (see `agents.md` for the full pattern) — middleware
is preferred because it keeps the extension scoped to relevant tools/hooks:

```python
from langchain.agents import AgentState
from langchain.agents.middleware import AgentMiddleware

class CustomState(AgentState):
    user_preferences: dict

class CustomMiddleware(AgentMiddleware):
    state_schema = CustomState
    tools = [tool1, tool2]
    def before_model(self, state: CustomState, runtime):
        ...

agent = create_agent(model, tools=tools, middleware=[CustomMiddleware()])
result = agent.invoke({
    "messages": [{"role": "user", "content": "I prefer technical explanations"}],
    "user_preferences": {"style": "technical", "verbosity": "detailed"},
})
```

Custom state schemas **must be `TypedDict`** as of `langchain 1.0` (Pydantic
models and dataclasses are no longer accepted here).

**Persisting short-term memory across separate `invoke` calls** (so the agent
remembers earlier turns in the same conversation) requires a **checkpointer**,
e.g. `InMemorySaver` for dev, or a DB-backed one (Postgres, etc.) for production.
This is also a prerequisite for `HumanInTheLoopMiddleware` and any
thread-scoped call/tool limits (see `middleware.md`).

```python
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(model, tools=tools, checkpointer=InMemorySaver())
agent.invoke({"messages": [...]}, config={"configurable": {"thread_id": "abc-123"}})
```

## Long-term memory

Built on **LangGraph stores** — JSON documents organized by `namespace` (like a
folder; often `(user_id, app_context)`) and `key` (like a filename). Survives
across threads/sessions, and supports content-filtered + vector-similarity search.

```python
from langchain.agents import create_agent
from langgraph.store.memory import InMemoryStore   # dev only — use a DB-backed store in prod

store = InMemoryStore()
agent = create_agent("claude-sonnet-4-6", tools=[], store=store)
```

Production (Postgres) variant:
```python
from langgraph.store.postgres import PostgresStore

DB_URI = "postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable"
with PostgresStore.from_conn_string(DB_URI) as store:
    store.setup()
    agent = create_agent("claude-sonnet-4-6", tools=[], store=store)
```

### Raw store operations

```python
namespace = (user_id, "chitchat")
store.put(namespace, "a-memory", {"rules": ["User likes short, direct language"], "my-key": "my-value"})
item = store.get(namespace, "a-memory")
items = store.search(namespace, filter={"my-key": "my-value"}, query="language preferences")
```
`search` supports vector-similarity ranking if you configure an `IndexConfig`
with an embedding function on the store.

### Reading long-term memory from a tool

```python
from dataclasses import dataclass
from langchain.tools import ToolRuntime, tool

@dataclass
class Context:
    user_id: str

@tool
def get_user_info(runtime: ToolRuntime[Context]) -> str:
    """Look up user info."""
    user_id = runtime.context.user_id
    user_info = runtime.store.get(("users",), user_id)
    return str(user_info.value) if user_info else "Unknown user"

agent = create_agent(model="claude-sonnet-4-6", tools=[get_user_info], store=store, context_schema=Context)
agent.invoke({"messages": [...]}, context=Context(user_id="user_123"))
```

### Writing long-term memory from a tool

```python
from typing_extensions import TypedDict

class UserInfo(TypedDict):
    name: str

@tool
def save_user_info(user_info: UserInfo, runtime: ToolRuntime[Context]) -> str:
    """Save user info."""
    runtime.store.put(("users",), runtime.context.user_id, dict(user_info))
    return "Successfully saved user info."

agent = create_agent(model="claude-sonnet-4-6", tools=[save_user_info], store=store, context_schema=Context)
agent.invoke({"messages": [{"role": "user", "content": "My name is John Smith"}]}, context=Context(user_id="user_123"))
```

## Memory in Deep Agents (filesystem-backed)

Deep Agents has a third practical pattern: **memory as files**. The
`FilesystemMiddleware` (see `deepagents_backends.md`) gives the agent
`ls`/`read_file`/`write_file`/`edit_file` tools. With a `CompositeBackend`
routing `/memories/` to a `StoreBackend`, anything the agent writes under that
path becomes persistent long-term memory automatically, while everything else
stays ephemeral, thread-scoped state:

```python
from deepagents.middleware import FilesystemMiddleware
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()
agent = create_agent(
    model="claude-sonnet-4-6", store=store,
    middleware=[FilesystemMiddleware(
        backend=CompositeBackend(default=StateBackend(), routes={"/memories/": StoreBackend()})
    )],
)
```
This is the mechanism behind `deepagents`' `AGENTS.md`-style persistent memory
(coding style, preferences, conventions) that survives across sessions.

## Which should you reach for?

- Need the agent to recall the last few turns within one chat → short-term state
  (built in automatically) + a checkpointer if it must survive separate `invoke`
  calls.
- Need the agent to recall facts about a *user* across completely different
  sessions/threads → long-term `store`.
- Building a coding/research agent that should remember conventions, notes, or
  scratch files across a long task or across sessions → Deep Agents filesystem
  memory with a `CompositeBackend` routing `/memories/` to a `StoreBackend`.