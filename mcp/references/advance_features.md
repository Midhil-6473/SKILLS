# Advanced Server Features — Sampling, Elicitation, Progress, Logging

## Sampling — a server asking the connected LLM for help

Normally, data flows model → server (the model calls a tool). **Sampling reverses
this**: a server, mid-tool-execution, can ask the client's connected LLM to generate
something, then use that result to continue its own work — without the server needing
its own separate API key or LLM integration.

```python
from mcp.server.fastmcp import FastMCP, Context

mcp = FastMCP("SummarizerServer")

@mcp.tool()
async def summarize_long_document(text: str, ctx: Context) -> str:
    """Summarize a long document using the connected LLM."""
    result = await ctx.session.create_message(
        messages=[{"role": "user", "content": {"type": "text", "text": f"Summarize concisely:\n\n{text}"}}],
        max_tokens=200,
    )
    return result.content.text
```

**This only works if the client declared sampling support during capability
negotiation** — not every MCP client implements this optional feature. Practical use
cases: a RAG server pre-summarizing a long retrieved document before returning a
concise version; a code-review server asking for an inline code review; any server
that needs "a bit of LLM reasoning" as an implementation detail without managing its
own model access or credentials.

## Elicitation — a server asking the user for structured input

Sometimes a tool needs information it can't determine on its own — elicitation lets
the server pause and request structured input directly from the human user, mid-task.

```python
@mcp.tool()
async def book_restaurant(restaurant: str, ctx: Context) -> str:
    """Book a table, asking the user for party size and time if not already known."""
    result = await ctx.elicit(
        message="What time and party size would you like?",
        schema={
            "type": "object",
            "properties": {
                "party_size": {"type": "integer"},
                "time": {"type": "string"},
            },
            "required": ["party_size", "time"],
        },
    )
    if result.action == "accept":
        return make_booking(restaurant, result.content["party_size"], result.content["time"])
    return "Booking cancelled."
```

Two ways hosts commonly present elicitation to the user:
- **Form mode** — the host shows a dialog with fields matching the server's schema
  (e.g., a party-size-and-time form).
- **URL mode** — the host opens a browser URL (for OAuth-style flows or anything
  needing a richer UI than a simple form), and the user confirms completion back in
  the client.

No special client-side configuration is required for elicitation to work — dialogs
appear automatically when a server requests them, in hosts that support the feature.

## Progress reporting — for long-running tools

```python
@mcp.tool()
async def process_large_dataset(file_path: str, ctx: Context) -> str:
    """Process a large dataset with progress reporting."""
    rows = list(read_rows(file_path))
    for i, row in enumerate(rows):
        process_row(row)
        await ctx.report_progress(progress=i, total=len(rows))
    return f"Processed {len(rows)} rows"
```

Clients that support progress notifications can show a live progress bar rather than
an undifferentiated "waiting" state — valuable for anything taking more than a
couple of seconds.

## Logging — sending diagnostic messages to the client

```python
@mcp.tool()
async def risky_operation(ctx: Context) -> str:
    await ctx.debug("Starting risky_operation")
    try:
        result = do_the_thing()
        await ctx.info(f"Completed successfully: {result}")
        return result
    except Exception as e:
        await ctx.error(f"Failed: {e}")
        raise
```

Log messages flow to the client (and often surface in the host's debug/developer
UI), distinct from a tool's actual return value — useful for observability without
polluting the tool's structured output.

## Notifications — servers pushing real-time updates

```python
@mcp.tool()
def add_document(content: str) -> str:
    """Add a document, notifying clients the resource list changed."""
    doc_id = save_document(content)
    mcp.send_resource_list_changed()  # tells connected clients to re-fetch the resource list
    return doc_id
```

Because MCP sessions are persistent (not request/response like plain REST), servers
can push notifications — a new tool became available, a resource's content changed,
a long job finished — instead of forcing clients to poll repeatedly.

## Completions — argument autocompletion

```python
@mcp.tool()
def get_weather(city: str) -> str:
    """Get weather for a city."""
    ...

@mcp.completion()
async def complete_city(argument: str, value: str) -> list[str]:
    if argument == "city":
        return [c for c in KNOWN_CITIES if c.lower().startswith(value.lower())]
    return []
```

Lets a host offer autocomplete suggestions as the user (or model, in some UIs) fills
in a tool/prompt argument — a smaller but genuinely useful UX feature for
higher-cardinality argument values (city names, product SKUs, usernames).

## Roots — client-declared filesystem/workspace boundaries

Clients can declare **roots** — directories the server is allowed to operate within
(e.g., the currently open project folder in an IDE) — giving servers a scoped,
client-controlled boundary rather than unrestricted filesystem access:

```python
@mcp.tool()
async def list_project_files(ctx: Context) -> list[str]:
    """List files within the client's declared project roots."""
    roots = await ctx.session.list_roots()
    files = []
    for root in roots.roots:
        files.extend(list_files_in(root.uri))
    return files
```

This is the mechanism behind how a coding assistant host scopes a filesystem server
to "only this open project," rather than the server having free rein over the whole
disk.

## Practical guidance

1. **Use sampling when a tool needs "a bit of LLM reasoning" as an implementation
   detail**, without the server managing its own model credentials — but remember it
   depends on client support, so don't build a server that *requires* it without a
   fallback.
2. **Use elicitation for genuinely missing required information**, not as a
   substitute for good tool argument design — if a parameter can reasonably be
   inferred or defaulted, do that instead of adding an interruption.
3. **Report progress on anything long-running** — this is cheap to add and
   meaningfully improves perceived responsiveness.
4. **Use roots to scope filesystem/workspace-aware servers** to client-declared
   boundaries rather than assuming unrestricted access.