---
name: llamaindex-architect
description: >
  Complete, up-to-date (2026) architect's manual for LlamaIndex, the leading Python
  framework for building RAG pipelines, LLM agents, and agentic workflows over private
  data. Use this skill whenever the user asks about LlamaIndex, RAG (Retrieval Augmented
  Generation), vector databases (ChromaDB, Pinecone, Qdrant, Weaviate, FAISS, pgvector,
  etc.), chunking and splitting strategies, embeddings, document loading, indexing, query
  engines, chat engines, agents, workflows, or integrating LlamaIndex with LangChain,
  LangGraph, or other agentic frameworks. Also trigger for questions like what RAG is,
  how vector databases work, how to build a chatbot over documents, how to chunk PDFs, or
  anything about production RAG, advanced retrieval, HyDE, reranking, hybrid search, or
  LlamaParse. Trigger even if the user uses older terminology such as GPT Index, or asks
  which framework to use for RAG between LlamaIndex and LangChain.
---

# The LlamaIndex Architect's Manual (2026)

You are acting as an expert LlamaIndex architect. LlamaIndex (formerly GPT Index) is the
leading Python framework for **context-augmented LLM applications** — connecting LLMs to
your private data via RAG pipelines, agents, and event-driven workflows.

## The one-line orientation

> **LlamaIndex = Load → Index → Query**, all powered by the same LLM/embedding models,
> with agents and event-driven Workflows on top for complex orchestration.

**Docs home:** `developers.llamaindex.ai/python/framework/`
**API reference:** `developers.llamaindex.ai/python/framework-api-reference/`

## What LlamaIndex is (vs. LangChain)

| | LlamaIndex | LangChain |
|---|---|---|
| **Primary strength** | Data ingestion, chunking, indexing, and retrieval over private docs | Agent orchestration, tool chaining, middleware |
| **Best for** | RAG pipelines, document Q&A, semantic search, structured extraction | Multi-step agents, complex tool use, middleware-rich pipelines |
| **Sweet spot** | "Answer questions about my documents" | "Build an agent with many tools, APIs, and logic" |
| **Hybrid stacks** | LlamaIndex for indexing + retrieval → LangChain agent for reasoning | Both coexist; LlamaIndex indexes, LangChain reasons |

They are complementary. Hybrid stacks are common: use LlamaIndex for its "batteries-included"
RAG and LangChain/LangGraph for agent orchestration. LlamaIndex tools can be wrapped into
LangChain `BaseTool` objects. LangChain LLMs and embeddings can be used inside LlamaIndex.

## The five-stage RAG mental model

All LlamaIndex work flows through five stages:

```
Load → Index → Store → Query → Evaluate
```

1. **Load** — `SimpleDirectoryReader`, `LlamaHub` connectors (160+ formats), `LlamaParse`
2. **Index** — Convert documents into searchable structures (embeddings → vector stores)
3. **Store** — Persist indexes to avoid re-indexing (local disk, vector DB, cloud)
4. **Query** — `QueryEngine` (Q&A), `ChatEngine` (conversation), retrieval + response synthesis
5. **Evaluate** — Measure faithfulness, relevancy, accuracy

## Quick 5-line start (the famous example)

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()
response = query_engine.query("What does this document say about X?")
print(response)
```

This is real, working code. It reads every file in `./data/`, chunks + embeds them, builds
an in-memory vector index, and answers the question — using OpenAI by default.

## The `Settings` object — configure once, apply everywhere

```python
from llama_index.core import Settings
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding

Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0.1)
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
Settings.chunk_size = 512       # tokens per chunk (node)
Settings.chunk_overlap = 50     # overlap between consecutive chunks
```

`Settings` is a global singleton. Every index, retriever, and query engine uses it as
the default unless explicitly overridden. Set it once at app startup.

## How to use this skill (routing map)

Read the relevant reference file based on what the user is asking. Don't load all files at once.

| Topic | Reference file |
|---|---|
| What is RAG, how it works, when to use it, 5-stage model | `references/rag_fundamentals.md` |
| Loading data: readers, SimpleDirectoryReader, LlamaHub, LlamaParse, Documents/Nodes, node parsers, chunking/splitting, IngestionPipeline | `references/loading_and_nodes.md` |
| Indexing: VectorStoreIndex, SummaryIndex, KeywordIndex, PropertyGraphIndex, embeddings deep dive | `references/indexing_and_embeddings.md` |
| Vector databases: ChromaDB, Pinecone, Qdrant, Weaviate, FAISS, pgvector — setup, persist, metadata filtering, hybrid search | `references/vector_databases.md` |
| Querying: QueryEngine, ChatEngine, Retrievers, node postprocessors, response synthesizers, response modes, advanced retrieval patterns (HyDE, reranking, fusion) | `references/querying_and_retrieval.md` |
| Agents: FunctionAgent, AgentWorkflow, ReActAgent, tools, memory, multi-agent patterns, HITL | `references/agents.md` |
| Workflows: event-driven Workflow class, steps, events, async, concurrency, streaming, state, loops, deployment | `references/workflows.md` |
| LangChain, LangGraph, and other framework integrations; MCP tools, llama_deploy | `references/integrations.md` |
| Evaluation, observability, LlamaCloud, LlamaParse advanced, production patterns | `references/advanced_and_production.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **`Settings` first.** Set `Settings.llm` and `Settings.embed_model` before building any
   index or query engine. Failing to do so defaults to OpenAI — which may surprise users
   trying to use Anthropic, local models, etc.
2. **Persist indexes.** `index.storage_context.persist(persist_dir="./storage")` prevents
   re-embedding on every restart. Expensive API calls otherwise.
3. **Chunk size matters.** Default 1024 tokens is often too large for precise retrieval.
   512 with 50 overlap is a solid starting point; tune for your use case.
4. **Use `IngestionPipeline` for production.** More control over chunking, metadata, and
   deduplication than `from_documents()`.
5. **For async.** LlamaIndex is async-first. In scripts, wrap in `asyncio.run(main())`.
   In FastAPI or Jupyter, you can `await` directly.
6. **LlamaIndex is modular.** The main `llama-index` package is an umbrella. Real integrations
   live in separate packages: `llama-index-llms-openai`, `llama-index-vector-stores-chroma`,
   etc. Always `pip install` the specific integration you need.
7. **Source of truth:** `developers.llamaindex.ai`. If the user's question involves a very
   recent feature or niche integration, web-search the official docs rather than guessing.