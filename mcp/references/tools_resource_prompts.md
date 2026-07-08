# Tools, Resources, and Prompts — The Three Core Primitives

## The critical distinction: who decides to invoke it

This is the design question that matters most when building a server:

| Primitive | Web analogy | Has side effects? | Who decides to use it |
|---|---|---|---|
| **Tool** | POST endpoint | Yes — executes actions | The **model**, autonomously (with user approval in most hosts) |
| **Resource** | GET endpoint | No — read-only | The **client/user**, explicitly (e.g. `@`-mentioning a file) |
| **Prompt** | Reusable template / slash command | No — just structures a message | The **user**, explicitly selecting it |

A simple rule of thumb used widely in practice: **if it has side effects, it's a
Tool; if it's read-only, it's a Resource.**

## Tools — executable functions with side effects

Tools are Python functions exposed to the LLM. When the model decides a tool is
relevant, it sends a request with arguments matching the tool's schema; your function
executes; the result returns to the model to incorporate into its response.

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("UtilityServer")

@mcp.tool()
def convert_usd_to_eur(amount: float, rate: float = 0.91) -> float:
    """Converts a given amount in USD to EUR using the provided rate."""
    return round(amount * rate, 2)
```

The docstring becomes the tool's description shown to the model — **write it as
carefully as you'd write a function's public API documentation**, since the model's
decision to call the tool (and how it fills in arguments) depends entirely on this
description and the type-hinted signature.

### Tool annotations — communicating behavior without spending tokens

```python
from mcp.types import ToolAnnotations

@mcp.tool(
    annotations=ToolAnnotations(
        title="Calculate Sum",
        readOnlyHint=True,      # doesn't modify state
        openWorldHint=False,    # doesn't interact with unpredictable external systems
    )
)
def calculate_sum(a: float, b: float) -> float:
    """Add two numbers together."""
    return a + b
```

Annotations describe a tool's safety profile (destructive vs. non-destructive,
read-only vs. mutating) to client applications **without consuming prompt context** —
distinct from the docstring, which the model does read.

### Supported parameter types

```python
from typing import List, Dict, Optional
from datetime import date

@mcp.tool()
def process(
    items: List[str],                # ✓ supported
    config: Dict[str, str],          # ✓ supported
    due_date: Optional[date] = None, # ✓ supported
    custom_obj: MyClass = None,      # ✗ not supported — use a dict instead
) -> dict:
    ...
```

FastMCP supports all Pydantic-compatible types (primitives, collections, dates,
UUIDs, enums) for automatic schema generation and validation — custom classes must be
converted to dicts/Pydantic models first.

### Structured output

```python
from pydantic import BaseModel

class WeatherResult(BaseModel):
    temperature_f: float
    conditions: str

@mcp.tool()
def get_weather(city: str) -> WeatherResult:
    """Get current weather for a city."""
    return WeatherResult(temperature_f=72.0, conditions="Sunny")
```

If you don't provide an explicit output schema, FastMCP automatically generates one
from the function's return type annotation.

## Resources — read-only, addressable data

Resources give clients (not the model directly) a way to load information into
context — think file-like data the user or client attaches deliberately, rather than
something the model reaches for mid-reasoning.

```python
@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """Get a personalized greeting"""
    return f"Hello, {name}!"

@mcp.resource("config://app-settings", description="Current application settings")
def get_settings() -> str:
    return json.dumps(load_settings())
```

**Always provide an explicit `description`** in the decorator — docstring parsing for
resources is less reliable across FastMCP versions than it is for tools, so an
explicit description ensures clients show something meaningful when listing resources.

Resources are identified by a **URI** (`greeting://{name}`, `config://app-settings`)
and can be:
- **Static** — a fixed URI returning fixed or slowly-changing content (a config file).
- **Dynamic** — a templated URI (`{name}` above) returning different data per
  request, similar to a parameterized GET endpoint.

### How resources surface in hosts

In Claude Code, for example, resources appear via `@`-mention autocomplete alongside
regular files — the user explicitly chooses to attach a resource's content to their
message, rather than the model deciding to fetch it mid-conversation the way it would
call a tool.

## Prompts — reusable, user-selected templates

Prompts standardize common interaction patterns — parameterized message templates
the host can surface as a menu item or slash command.

```python
@mcp.prompt()
def greet_user(name: str, style: str = "friendly") -> str:
    """Generate a greeting prompt"""
    styles = {
        "friendly": "Please write a warm, friendly greeting",
        "formal": "Please write a formal, professional greeting",
        "casual": "Please write a casual, relaxed greeting",
    }
    return f"{styles.get(style, styles['friendly'])} for someone named {name}."
```

### A more elaborate example — a multi-step strategic prompt

```python
from mcp.server.fastmcp.prompts import base

@mcp.prompt()
def research_report_plan(topic: str) -> list[base.Message]:
    """Guide the model through a structured research workflow using this server's tools."""
    return [
        base.UserMessage(f"I want a research report on: {topic}"),
        base.AssistantMessage(
            "I'll approach this in three steps: (1) search_arxiv to find relevant "
            "papers, (2) summarize_paper on the most relevant ones, (3) synthesize "
            "findings into a report. Let me start with step 1."
        ),
    ]
```

Prompts aren't just static text — they can encode a **strategic plan** instructing
the model how to sequence a server's tools to accomplish a complex task, which is
especially valuable for servers with several interdependent tools.

When a client lists available prompts, it sees their names, descriptions, and
required arguments — the user picks one explicitly (often via a slash command in the
host UI), then supplies the arguments.

## Choosing correctly — worked examples

| Scenario | Primitive | Why |
|---|---|---|
| "Run this SQL query" | Tool | Executes an action (even if `SELECT`, it's model-invoked on demand) |
| "The current database schema" | Resource | Static, read-only context the user attaches |
| "Send a Slack message" | Tool | Side effect |
| "This week's project README" | Resource | Read-only content |
| "Standardized bug report template" | Prompt | User-selected interaction structure |
| "Summarize this PDF" | Tool (if it processes on demand) or Resource (if the PDF content itself is exposed for the model to read) | Depends on whether the *action* (summarizing) or the *data* (the PDF text) is what's being exposed |

That last row is a genuinely common judgment call — when in doubt, ask: is the
primary value "the LLM should read this data" (Resource) or "the LLM should trigger
this computation/action" (Tool)?

## Practical guidance

1. **Write tool docstrings as carefully as public API docs** — the model's tool
   selection accuracy depends entirely on how clearly the docstring and parameter
   names communicate intent.
2. **Use annotations (`readOnlyHint`, `openWorldHint`) to describe safety profile**
   without burning prompt tokens on it.
3. **Keep tool count focused** — a median production MCP server exposes around 5
   tools; too many similar-sounding tools measurably hurts model selection accuracy.
4. **Always provide explicit `description` on resources** — don't rely on docstring
   parsing alone.
5. **Use prompts to encode multi-step strategic guidance** for servers whose tools
   are meant to be used in a particular sequence, not just as static text snippets.