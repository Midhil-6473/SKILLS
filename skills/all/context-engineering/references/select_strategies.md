# Select Strategies — Pulling Only What's Needed, On Demand

## The core idea

**Selecting context means pulling information *into* the context window only
when it's actually needed** — the inverse discipline to Write (which pushes
information *out*). Together, Write and Select form a pair: you write
something out specifically so that you can select it back in later, on
demand, instead of it permanently occupying space in every subsequent call.

## Scope by default — the governing principle

Google's ADK frames this precisely: **"every model call and sub-agent sees
the minimum context required. Agents must reach for more information
explicitly via tools, rather than being flooded by default."** This inverts
the natural instinct (when in doubt, include more context, just in case) —
the correct default is minimal, with explicit, tool-mediated retrieval as the
mechanism for getting more when genuinely needed.

## Tool-result references instead of inline results

```python
# Naive: the full tool result goes directly into context, every time
@agent.tool
def search_documents(query: str) -> str:
    """Search the document store."""
    results = document_store.search(query, k=20)
    return "\n\n".join(r.full_text for r in results)   # potentially huge, ALL of it in context

# Select-strategy version: store the large result externally, return a reference
@agent.tool
def search_documents(query: str) -> str:
    """Search the document store."""
    results = document_store.search(query, k=20)
    result_id = save_to_workspace(results)   # written to the filesystem/a store, NOT context
    summary = f"Found {len(results)} results. Top match: {results[0].title}"
    return f"{summary}\nFull results saved to: {result_id} (use read_file to view)"
```

This is precisely the mechanism behind LangChain Deep Agents' built-in
context compression: **"large tool inputs and results are stored in the
filesystem and replaced with references"** — the agent still has the
information (it can retrieve it via a file-read tool whenever actually
needed for the current step), but it doesn't permanently occupy context
tokens on every subsequent turn just because it was fetched once.

## RAG as a Select strategy

Retrieval-Augmented Generation (see this collection's `llamaindex-architect`
and `langchain-architect` skills) is itself a Select strategy at its core:
rather than putting an entire document corpus into context upfront, you
retrieve only the chunks relevant to the *current* query, on demand. The
context-engineering lens adds a specific discipline on top of the RAG
mechanics already covered in those skills: **retrieved chunk count and size
should be tuned as a context-budget decision, not just a retrieval-quality
decision** — reranking down to a smaller, higher-precision set (see this
collection's `llm-cost-optimization` skill's coverage of the same pattern
through a cost lens) serves both concerns simultaneously.

## Scoped tool exposure

```python
# Instead of exposing every possible tool to every agent/step regardless of relevance
all_tools = [tool_a, tool_b, tool_c, tool_d, tool_e, tool_f, tool_g, tool_h]  # all always present

# Select strategy: expose only the tools relevant to the CURRENT phase/role
def get_tools_for_phase(phase: str) -> list:
    if phase == "research":
        return [search_tool, read_document_tool]
    elif phase == "writing":
        return [write_file_tool, format_tool]
    return all_tools   # a sane fallback, not the default assumption
```

Every tool definition consumes context tokens on every single call whether
or not it's used (see this collection's `llm-cost-optimization` skill,
`agentic_and_rag_costs.md`, for the cost angle on this same fact) — scoping
tool exposure to what's relevant for the current phase or sub-agent role is
simultaneously a context-quality lever and a cost lever.

## Selective conversation history

```python
# Instead of always resending the FULL conversation history
full_history = get_all_messages(session_id)   # could be enormous by turn 50

# Select only what's relevant to the current step
recent_history = get_all_messages(session_id)[-6:]   # the last few turns, verbatim
relevant_summary = retrieve_relevant_past_context(session_id, current_query)  # semantic pull, if needed
```

Not every past turn is equally relevant to the current step — a Select-aware
design pulls in recent history verbatim (for continuity) plus specifically
relevant older context (via a retrieval mechanism) rather than assuming the
entire linear history must always be resent in full. This overlaps with
Compress strategies (`compress_strategies.md`) — the distinction is that
Select is about *which* content to include, Compress is about *how much
detail* to retain for content you've already decided to include.

## Practical guidance

1. **Default to minimal context and explicit, tool-mediated retrieval** —
   invert the instinct to include more "just in case."
2. **Return references, not full results, from tools producing large
   output** — store the full result externally, let the agent retrieve it
   selectively only when actually needed for the next step.
3. **Tune RAG retrieval count/size as a context-budget decision**, not only a
   retrieval-quality one — this serves both context engineering and cost
   goals simultaneously.
4. **Scope tool exposure to the current phase/role** rather than always
   presenting every possible tool regardless of relevance.
5. **Distinguish Select (which content) from Compress (how much detail per
   included item)** — they're complementary, not the same lever.