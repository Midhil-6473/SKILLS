# Integrations — LangChain, LangGraph, MCP, and Other Agentic Frameworks

## The honest framework comparison

| | LlamaIndex | LangChain | LangGraph |
|---|---|---|---|
| **Origin** | RAG/data toolkit (formerly GPT Index) | LLM orchestration chains | Explicit agent graph orchestration |
| **Core abstraction** | Index + QueryEngine | Chain / Runnable | Graph (nodes, edges, state) |
| **Agent orchestration** | `AgentWorkflow`, custom `Workflow` | `create_agent` (built on LangGraph) | Native — the agent framework itself |
| **Data/RAG maturity** | Best-in-class — purpose-built | Good, less opinionated | Relies on LangChain integrations |
| **Control flow** | Event-driven steps, async-first | Middleware hooks | Explicit graph with full control over loops/branches |
| **When it shines** | Document-heavy retrieval, complex parsing/chunking | Tool-rich agents, many integrations | Production agent loops needing explicit state machines |

**The practical takeaway used across the industry in 2026:** there is no universally
"best" framework. A very common production pattern is:

> **LlamaIndex for the knowledge/retrieval layer + LangGraph for the orchestration layer**

LlamaIndex's deep data connectors, chunking strategies, and retrieval quality remain
hard to beat; LangGraph's explicit graph model gives more production control over
multi-step agent loops, checkpointing, and conditional branching than implicit agent loops.

## Pattern 1: Wrap a LlamaIndex QueryEngine as a LangChain tool

The most common integration — use LlamaIndex's superior retrieval as a tool inside a
LangChain/LangGraph agent.

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core.tools import QueryEngineTool, ToolMetadata

# Build the LlamaIndex side
documents = SimpleDirectoryReader("./data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

query_engine_tool = QueryEngineTool(
    query_engine=query_engine,
    metadata=ToolMetadata(
        name="product_kb",
        description="Search the product knowledge base for features, pricing, specs.",
    ),
)

# Convert to a LangChain-compatible tool
langchain_tool = query_engine_tool.to_langchain_tool()
```

### Using it inside a LangGraph agent

```python
from langchain.chat_models import init_chat_model
from langchain.agents import create_agent

model = init_chat_model("anthropic:claude-sonnet-4-6")
agent = create_agent(model, tools=[langchain_tool])

result = agent.invoke({
    "messages": [{"role": "user", "content": "What's our refund policy?"}]
})
```

### Or wrap it manually as a plain LangChain `@tool` (more explicit control)

```python
from langchain_core.tools import tool

@tool
def search_product_kb(query: str) -> str:
    """Search the product knowledge base for information about features,
    pricing, technical specifications, integrations, and product roadmap."""
    response = query_engine.query(query)
    return str(response)
```

This pattern is identical for any LlamaIndex `QueryEngine`, `ChatEngine`, or `Retriever` —
write a thin wrapper function with a good docstring and the LangChain/LangGraph agent
treats it like any other tool.

## Pattern 2: Full RAG agent with LangGraph as the state machine

A realistic production pattern: LlamaIndex handles ingestion/retrieval; LangGraph
explicitly orchestrates routing, guardrails, and tool use as a state graph.

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o", temperature=0.0)
llm_with_tools = llm.bind_tools([langchain_tool])

def agent_node(state: MessagesState) -> dict:
    return {"messages": [llm_with_tools.invoke(state["messages"])]}

def guardrail_node(state: MessagesState) -> dict:
    # Custom validation logic on the final response before returning to the user
    return state

graph = (
    StateGraph(MessagesState)
    .add_node("agent", agent_node)
    .add_node("tools", ToolNode([langchain_tool]))
    .add_node("guardrail", guardrail_node)
    .add_edge(START, "agent")
    .add_conditional_edges("agent", tools_condition, {"tools": "tools", END: "guardrail"})
    .add_edge("tools", "agent")
    .add_edge("guardrail", END)
    .compile()
)
```

This gives explicit control over checkpointing, conditional routing, and post-processing
that an implicit agent loop doesn't expose as cleanly.

## Pattern 3: Using LangChain LLMs/embeddings inside LlamaIndex

If you'd rather standardize on LangChain's model interface but still want LlamaIndex's
indexing/retrieval:

```python
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from llama_index.llms.langchain import LangChainLLM
from llama_index.embeddings.langchain import LangchainEmbedding
from llama_index.core import Settings

Settings.llm = LangChainLLM(llm=ChatOpenAI(model="gpt-4o-mini"))
Settings.embed_model = LangchainEmbedding(OpenAIEmbeddings(model="text-embedding-3-small"))
```

Any LangChain-compatible model becomes usable across all LlamaIndex indexes, query
engines, and agents this way.

## Pattern 4: LangChain tools inside a LlamaIndex agent

The reverse direction is less directly supported (LlamaIndex agents expect plain Python
functions or `BaseTool`-style LlamaIndex tools), but you can wrap any LangChain tool's
`.invoke()` in a plain function:

```python
from langchain_community.tools import DuckDuckGoSearchRun
from llama_index.core.agent.workflow import FunctionAgent

search = DuckDuckGoSearchRun()

def web_search(query: str) -> str:
    """Search the web for current information."""
    return search.invoke(query)

agent = FunctionAgent(tools=[web_search, query_engine_tool.to_tool_call_able()], llm=llm)
```

## Model Context Protocol (MCP)

LlamaIndex supports MCP both as a client (using external MCP tools) and a server
(exposing LlamaIndex workflows/tools as MCP).

### Using MCP tools inside LlamaIndex

```bash
pip install llama-index-tools-mcp
```

```python
from llama_index.tools.mcp import BasicMCPClient, McpToolSpec

mcp_client = BasicMCPClient("https://example.com/mcp")
mcp_tool_spec = McpToolSpec(client=mcp_client)

tools = await mcp_tool_spec.to_tool_list_async()
agent = FunctionAgent(tools=tools, llm=llm)
```

### Exposing a LlamaIndex Workflow as an MCP server

```python
from llama_index.tools.mcp import workflow_as_mcp

mcp_server = workflow_as_mcp(my_workflow, name="my-rag-tool")
mcp_server.run()
```

This lets any MCP-compatible client (Claude, Claude Code, other agent frameworks) call
your LlamaIndex RAG pipeline as a standard tool.

## Other agentic framework integrations

- **CrewAI**: wrap LlamaIndex query engines as CrewAI `Tool` objects the same way as
  LangChain — thin function wrapper with a docstring.
- **AutoGen / Microsoft Agent Framework**: same pattern — LlamaIndex retrieval as a
  callable function tool.
- **Haystack**: LlamaIndex and Haystack don't directly interop; typically choose one
  for the retrieval layer.
- **LlamaDeploy / llamactl**: deploy LlamaIndex Workflows as standalone microservices
  with an HTTP API — framework-agnostic once deployed, so any external agent
  (regardless of framework) can call it over HTTP.

## Decision guide: which integration pattern to recommend

| Situation | Recommendation |
|---|---|
| Already deep in LangChain/LangGraph, need better retrieval | Wrap LlamaIndex `QueryEngine` as a LangChain tool (Pattern 1) |
| Building a new agent from scratch, RAG-heavy | Start with LlamaIndex `FunctionAgent`/`AgentWorkflow`, no LangChain needed |
| Need explicit state machine control (checkpointing, branching, HITL) over agent loop | LangGraph for orchestration + LlamaIndex for retrieval (Pattern 2) |
| Want to standardize model config across both | LangChain model wrapped via `LangChainLLM`/`LangchainEmbedding` (Pattern 3) |
| Need to expose RAG to non-Python or cross-framework consumers | Deploy via `llamactl`/MCP server, framework-agnostic |