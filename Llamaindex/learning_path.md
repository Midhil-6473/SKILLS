# Beginner → Advanced Learning Path (LlamaIndex, 2026)

Use this as a curriculum when the user wants a structured roadmap. Each phase names the
reference file(s) to pull detail from.

## Phase 0 — Orientation (15 minutes)

- Understand RAG conceptually: LLMs don't know your private data; RAG provides it at
  query time. See `rag_fundamentals.md`.
- Understand the 5-stage pipeline: Load → Index → Store → Query → Evaluate.
- Install: `pip install llama-index` + provider-specific packages
  (`llama-index-llms-openai`, etc.)
- Run the 5-line starter (see `SKILL.md`).

## Phase 1 — Foundations: Loading & Chunking

*Read: `loading_and_nodes.md`*

1. `SimpleDirectoryReader` for local files.
2. Understand `Document` vs `Node` — Document is the container, Node is the atomic chunk.
3. `SentenceSplitter` for basic chunking — experiment with `chunk_size`/`chunk_overlap`.
4. Browse LlamaHub for a connector relevant to the user's data source.

**Practice project:** Load 5-10 PDFs/text files, split into nodes, print the first few
nodes to see how chunking behaves at different `chunk_size` values.

## Phase 2 — Indexing & Embeddings

*Read: `indexing_and_embeddings.md`*

1. `VectorStoreIndex.from_documents()` — the default workhorse.
2. Set `Settings.embed_model` to a specific model (start with a free local one like
   `BAAI/bge-small-en-v1.5` to avoid API costs while learning).
3. Persist and reload an index (`storage_context.persist()` / `load_index_from_storage()`).
4. Understand why embedding model consistency matters (index vs. query time).

**Practice project:** Build an index, persist it, restart your script, reload it without
re-embedding. Confirm queries still work.

## Phase 3 — Querying

*Read: `querying_and_retrieval.md`*

1. `index.as_query_engine()` — basic Q&A.
2. `index.as_chat_engine()` — multi-turn conversation, try `condense_plus_context` mode.
3. Response modes: try `"compact"` vs `"tree_summarize"` on a summarization task.
4. Add a `SimilarityPostprocessor` to filter low-relevance results.

**Practice project:** Build a chat engine over a personal document set (notes, a book,
course material) and have a multi-turn conversation with it.

## Phase 4 — Vector Databases

*Read: `vector_databases.md`*

1. Move from in-memory to ChromaDB (easiest persistent option to start with).
2. Try metadata filtering — tag documents with category/date, filter at query time.
3. If working with larger scale, evaluate Pinecone or Qdrant.
4. Understand hybrid search (semantic + keyword) and when it helps.

**Practice project:** Migrate your Phase 3 chat engine to use a persistent ChromaDB
collection. Add metadata tags and filter queries by them.

## Phase 5 — Advanced Retrieval

*Read: `querying_and_retrieval.md` (advanced patterns section)*

1. Add reranking (Cohere or a local cross-encoder) — retrieve top_k=20, rerank to top_n=5.
2. Try HyDE for vague queries.
3. Try `SubQuestionQueryEngine` for multi-document comparison questions.
4. Try `RouterQueryEngine` to dynamically pick between multiple specialized indexes.

**Practice project:** Build two separate indexes (e.g., "policies" and "FAQs") and a
`RouterQueryEngine` that picks the right one based on the question.

## Phase 6 — Agents

*Read: `agents.md`*

1. `FunctionAgent` with simple Python function tools.
2. Wrap a `QueryEngine` as a `QueryEngineTool` — this is Agentic RAG.
3. Maintain conversation state with `Context`.
4. Stream agent events for live UX feedback.
5. Try `AgentWorkflow` with 2+ agents handing off to each other.

**Practice project:** Build an agent with both a calculator tool and a `QueryEngineTool`
over your documents; ask questions that require both.

## Phase 7 — Workflows (custom orchestration)

*Read: `workflows.md`*

1. Build a minimal 2-step `Workflow` with custom `Event` types.
2. Add a loop (e.g., retry-until-good-enough pattern).
3. Add parallel step execution with `num_workers` + `ctx.collect_events`.
4. Implement a simple Corrective RAG workflow: retrieve → evaluate → fallback to web
   search if insufficient → synthesize.

**Practice project:** Build a Corrective RAG workflow — this exercises branching, looping,
and tool use all together.

## Phase 8 — Integrations

*Read: `integrations.md`*

1. Wrap a LlamaIndex `QueryEngine` as a LangChain tool via `.to_langchain_tool()`.
2. Use that tool inside a LangGraph agent or LangChain `create_agent`.
3. If relevant, expose a LlamaIndex Workflow as an MCP server.

**Practice project:** Take your Corrective RAG workflow from Phase 7 and expose it as a
LangChain tool inside a LangGraph state machine with explicit checkpointing.

## Phase 9 — Production

*Read: `advanced_and_production.md`*

1. Add `FaithfulnessEvaluator` + `RelevancyEvaluator` to your pipeline.
2. Add observability (Arize Phoenix is free/open-source, good starting point).
3. Track token costs with `TokenCountingHandler`.
4. Review the production checklist and apply it to your project.
5. If parsing complex documents (tables, charts), evaluate LlamaParse.

**Practice project:** Add an evaluation harness to whichever project you built in earlier
phases — generate a synthetic Q&A eval set, measure faithfulness/relevancy, then tune
chunk size or reranking based on the scores.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer with a
specific production task):
- Go one phase at a time with a concrete, small practice project per phase.
- Default to free/local models (HuggingFace embeddings, Ollama) early on so cost isn't
  a barrier to experimentation — introduce paid APIs (OpenAI, Cohere rerank) once they're
  comfortable with the concepts.
- Check understanding with a small build before advancing — e.g., "before moving to
  vector databases, want to try changing your chunk_size and seeing how retrieval changes?"
- Flag clearly when something is a paid/cloud-only feature (LlamaCloud, Pinecone, Cohere
  rerank) vs. free/local, so cost expectations are set correctly from the start.