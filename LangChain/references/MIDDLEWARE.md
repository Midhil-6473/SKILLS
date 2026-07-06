# Middleware — Reference

Middleware is **the** defining extensibility mechanism of `create_agent` in
LangChain v1. It's how you customize agent behavior without forking the core
loop or dropping to raw LangGraph nodes.

## The agent loop and where hooks fire

The core loop: call the model → if it requests tools, call the tools → repeat
until no more tool calls. Middleware exposes hooks **before and after** each of
those steps.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware, HumanInTheLoopMiddleware

agent = create_agent(
    model="gpt-5.4",
    tools=[...],
    middleware=[SummarizationMiddleware(...), HumanInTheLoopMiddleware(...)],
)
```

Middleware hooks (used via decorators or by subclassing `AgentMiddleware`):

| Hook | Fires | Typical use |
|---|---|---|
| `before_model` | Before each model call | Inject context, trim/modify state |
| `wrap_model_call` | Wraps the model call | Dynamic model/tool/prompt selection, guardrails on the request |
| `after_model` | After each model call | Validate/filter the response, content moderation |
| `wrap_tool_call` | Wraps each tool execution | Custom error handling, dynamic tool execution, redaction |
| `dynamic_prompt` | Computes the system prompt | Role-based or context-based prompts |

Middleware is **not a separate runtime** — hooks run inside the compiled
LangGraph graph that `create_agent` returns, so the whole agent (with all its
middleware) can be nested as a node/subgraph in a bigger `StateGraph` (see
`agents.md`, "Embedding an agent inside a larger LangGraph").

## What middleware is good for

- Logging, analytics, debugging.
- Transforming prompts, tool selection, output formatting.
- Retries, fallbacks, early termination.
- Rate limits, guardrails, PII detection.

## Prebuilt middleware (provider-agnostic)

Import from `langchain.agents.middleware` unless noted otherwise.

### Summarization
Auto-summarizes older history when token/message thresholds are hit, keeping
recent messages intact.
```python
from langchain.agents.middleware import SummarizationMiddleware

agent = create_agent(
    model="gpt-5.4", tools=[...],
    middleware=[SummarizationMiddleware(
        model="gpt-5.4-mini",
        trigger=("tokens", 4000),     # or ("fraction", 0.8), ("messages", 6); list = OR logic
        keep=("messages", 20),        # or ("fraction", 0.3), ("tokens", N)
    )],
)
```
Key params: `model` (required), `trigger`, `keep`, `token_counter`,
`summary_prompt`, `trim_tokens_to_summarize` (default 4000).

### Human-in-the-loop
Pauses for approval/edit/rejection before sensitive tool calls run. **Requires a
checkpointer.**
```python
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="gpt-5.4", tools=[read_email, send_email],
    checkpointer=InMemorySaver(),
    middleware=[HumanInTheLoopMiddleware(interrupt_on={
        "send_email": {"allowed_decisions": ["approve", "edit", "reject"]},
        "read_email": False,
    })],
)
```

### Model call limit
Caps model calls to control cost/loops.
```python
from langchain.agents.middleware import ModelCallLimitMiddleware
ModelCallLimitMiddleware(thread_limit=10, run_limit=5, exit_behavior="end")  # or "error"
```
`thread_limit` needs a checkpointer (persists across runs in a thread);
`run_limit` resets each invocation.

### Tool call limit
Like above, but for tool calls — globally or per-tool.
```python
from langchain.agents.middleware import ToolCallLimitMiddleware
ToolCallLimitMiddleware(thread_limit=20, run_limit=10)                       # global
ToolCallLimitMiddleware(tool_name="search", thread_limit=5, run_limit=3)     # per-tool
```
`exit_behavior`: `'continue'` (default, blocks exceeded calls with an error
message but lets the agent carry on), `'error'` (raises immediately), `'end'`
(stops with a final message — single-tool scenarios only).

### Model fallback
Tries alternative models if the primary fails.
```python
from langchain.agents.middleware import ModelFallbackMiddleware
ModelFallbackMiddleware("gpt-5.4-mini", "claude-3-5-sonnet-20241022")
```

### PII detection
```python
from langchain.agents.middleware import PIIMiddleware

agent = create_agent(model="gpt-5.4", tools=[], middleware=[
    PIIMiddleware("email", strategy="redact", apply_to_input=True),
    PIIMiddleware("credit_card", strategy="mask", apply_to_input=True),
])
```
Built-in types: `email`, `credit_card`, `ip`, `mac_address`, `url`. Strategies:
`'block'`, `'redact'`, `'mask'`, `'hash'`. Custom detectors via regex string,
compiled regex, or a function returning `[{"text":..., "start":..., "end":...}]`.
Toggle `apply_to_input` / `apply_to_output` / `apply_to_tool_results`.

### To-do list
Gives the agent a `write_todos` tool + guiding system prompt for multi-step
planning.
```python
from langchain.agents.middleware import TodoListMiddleware
agent = create_agent(model="gpt-5.4", tools=[read_file, write_file, run_tests],
                      middleware=[TodoListMiddleware()])
```

### LLM tool selector
Uses an LLM to pick relevant tools before the main call — helpful once you have
10+ tools and most are irrelevant per query.
```python
from langchain.agents.middleware import LLMToolSelectorMiddleware
LLMToolSelectorMiddleware(model="gpt-5.4-mini", max_tools=3, always_include=["search"])
```

### Tool retry / Model retry
Exponential backoff retries for tool calls or model calls respectively.
```python
from langchain.agents.middleware import ToolRetryMiddleware, ModelRetryMiddleware

ToolRetryMiddleware(max_retries=3, backoff_factor=2.0, initial_delay=1.0,
                     retry_on=(ConnectionError, TimeoutError), on_failure="return_message")
ModelRetryMiddleware(max_retries=3, on_failure="continue")  # or "error", or a formatter fn
```

### LLM tool emulator
Replaces real tool execution with LLM-generated plausible responses — for
testing/prototyping before real tools exist.
```python
from langchain.agents.middleware import LLMToolEmulator
LLMToolEmulator()                              # emulate all tools
LLMToolEmulator(tools=["get_weather"])         # emulate only specific tools
```

### Context editing
Clears older tool outputs once token thresholds are hit, keeping the N most
recent results — distinct from full summarization.
```python
from langchain.agents.middleware import ContextEditingMiddleware, ClearToolUsesEdit

ContextEditingMiddleware(edits=[ClearToolUsesEdit(trigger=100000, keep=3)])
```
Options: `clear_at_least`, `clear_tool_inputs`, `exclude_tools`, `placeholder`.

### Shell tool
Gives the agent a persistent shell session.
```python
from langchain.agents.middleware import ShellToolMiddleware, HostExecutionPolicy, DockerExecutionPolicy

ShellToolMiddleware(workspace_root="/workspace", execution_policy=HostExecutionPolicy())
```
**Security matters here**: `HostExecutionPolicy` = full host access (trusted
environments only); `DockerExecutionPolicy` = isolated per-run container;
`CodexSandboxExecutionPolicy` = reuses Codex CLI sandbox for syscall/filesystem
restriction. Redaction rules sanitize output post-execution but **don't prevent
exfiltration** under `HostExecutionPolicy` — isolation, not redaction, is the
real boundary. Persistent shell sessions don't yet support interrupts/HITL.

### File search
Adds `glob`/`grep`-style search tools over a filesystem root.
```python
from langchain.agents.middleware import FilesystemFileSearchMiddleware
FilesystemFileSearchMiddleware(root_path="/workspace", use_ripgrep=True)
```

### Filesystem middleware (from Deep Agents)
Gives `ls` / `read_file` / `write_file` / `edit_file` tools backed by a pluggable
backend — the primary tool for context engineering against variable-length tool
results (web search, RAG, etc.). Full backend reference in
`deepagents_backends.md`.
```python
from deepagents.middleware.filesystem import FilesystemMiddleware
agent = create_agent(model="claude-sonnet-4-6", middleware=[FilesystemMiddleware(backend=None)])
```
Included automatically in `create_deep_agent`.

### Subagent (from Deep Agents)
Lets the agent delegate to subagents via a `task` tool — keeps the supervisor's
context clean while a subagent goes deep on a subtask in its own isolated
context window.
```python
from deepagents.middleware.subagents import SubAgentMiddleware

agent = create_agent(model="claude-sonnet-4-6", middleware=[SubAgentMiddleware(
    default_model="claude-sonnet-4-6", default_tools=[],
    subagents=[{
        "name": "weather", "description": "Gets weather in cities.",
        "system_prompt": "Use get_weather.", "tools": [get_weather],
        "model": "gpt-5.4", "middleware": [],
    }],
)])
```
A `general-purpose` subagent (same instructions/tools as the main agent) is
always available even without defining custom subagents — its purpose is pure
context isolation. You can also wrap a fully custom compiled LangGraph graph as
a subagent via `CompiledSubAgent`.

## Provider-specific middleware

- **Anthropic**: prompt caching, bash tool, text editor, memory, file search.
- **AWS**: prompt caching for Bedrock models.
- **OpenAI**: content moderation.

## Writing custom middleware

Two styles: function decorators (quick, single-hook) or subclassing
`AgentMiddleware` (multiple hooks, shared state/tools).

```python
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse

@wrap_model_call
def my_middleware(request: ModelRequest, handler) -> ModelResponse:
    # before: inspect/modify request
    response = handler(request)
    # after: inspect/modify response
    return response
```

```python
from langchain.agents.middleware import AgentMiddleware

class MyMiddleware(AgentMiddleware):
    state_schema = MyCustomState   # optional
    tools = [extra_tool]            # optional, tools owned by this middleware

    def before_model(self, state, runtime):
        ...

    def wrap_tool_call(self, request, handler):
        return handler(request)
```

Reach for custom middleware whenever you need: business-specific guardrails,
PII rules beyond the built-in detector types, custom dynamic tool/model
selection logic, or anything in the "dynamic tools/model/prompt" patterns shown
in `agents.md`.