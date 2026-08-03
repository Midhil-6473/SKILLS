# Developer Skills Workspace

Welcome to the **Skills** workspace. This repository is a curated collection of structured blueprints, architect manuals, and reference patterns for 12 developer skills. It functions as both a personal reference center and a capability store for agentic development.

To make this page highly readable and interactive, we've organized the domain references inside collapsible blocks below. You can copy the code from this file directly into your Git repository's `README.md`.

---

## ⚡ Quick CLI Installation & Setup

You can install and deploy these skills directly to your coding environments (such as **Claude Code**, **Gemini CLI**, **Copilot**, **Cursor**, etc.) using either of the following commands:

**Option 1: Using the Vercel Skills CLI (Displays the interactive tree UI)**
```bash
npx skills add Midhil-6473/SKILLS
```

**Option 2: Using the custom menu-driven CLI**
```bash
npx developer-skills-bank
```

### What the installer handles:

- **Cursor IDE**: Automates copying specific skill files directly into a project's `.cursorrules` file or combines all skills into a single set of rules.
- **Claude Desktop**: Updates your local `claude_desktop_config.json` to auto-mount this entire skills directory as a filesystem MCP server, exposing all manuals as reference material for the LLM.
- **Claude Code / Gemini CLI / Copilot**: Instructs you on how to point these CLI runners to the skills folders or feed skill specs directly into current terminal sessions.

---

## 🛠️ Technology Stack & Badges

Below are the main frameworks, languages, and tools documented across these developer skills:

![Java](https://img.shields.io/badge/Java-ED8B00?style=flat-square&logo=openjdk&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat-square&logo=mongodb&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat-square&logo=kubernetes&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3A?style=flat-square&logo=chainlink&logoColor=white)
![Pydantic](https://img.shields.io/badge/Pydantic-E92063?style=flat-square&logo=pydantic&logoColor=white)

---

## 📂 Directory Overview

```text
skills/skills/
├── DSA/                  # Data Structures & Algorithms in Java (Fundamentals to Advanced)
├── LangChain/            # LangChain v1 / LangGraph / Deep Agents (2026 Shift)
├── Llamaindex/           # Data Ingestion, Vector DBs, & Q&A RAG Pipelines
├── MongoDB/              # NoSQL Document Modeling, Aggregations, & Atlas Setup
├── PostgreSQL/           # SQL Fundamentals, Advanced Queries, & Operations
├── React/                # React + FastAPI AI UI/UX (Streaming, Agentic Panels)
├── docker-k8s-mlops/     # Containerization, Kubernetes Orchestration, & MLOps
├── fastapi_skill/        # High-performance FastAPI Backend Design & Auth
├── llm_agent_security/   # LLM & Agentic Security (Injection, Guardrails, Sandboxing)
├── mcp/                  # Model Context Protocol (FastMCP Servers & Transports)
├── pydantic/             # Pydantic v2 Schema validation, Settings, & PydanticAI agents
└── unsloth-finetuning/   # Unsloth Fine-tuning (LoRA, QLoRA, Model Export & Dataset Prep)
```

---

## 💡 Core Skills Summary

Here is a summary of each skill and direct links to their entrypoint manuals:

| Skill               | Description                                                              | Entrypoint                                             |
| :------------------ | :----------------------------------------------------------------------- | :----------------------------------------------------- |
| **DSA (Java)**      | Complete manual for Data Structures & Algorithms (DSA) in Java.          | [DSA/SKILL.md](skills/skills/DSA/SKILL.md)                           |
| **LangChain**       | Modern LLM applications using LangChain v1, LangGraph, and Deep Agents.  | [LangChain/SKILL.md](skills/skills/LangChain/SKILL.md)               |
| **LlamaIndex**      | Lead connector framework for context-augmented Q&A/RAG pipelines.        | [Llamaindex/SKILL.md](skills/skills/Llamaindex/SKILL.md)             |
| **MongoDB**         | NoSQL document modeling, compound indexes (ESR), and aggregations.       | [MongoDB/SKILL.md](skills/skills/MongoDB/SKILL.md)                   |
| **PostgreSQL**      | Relational schemas, analytical window queries, CTEs, and `JSONB` data.   | [PostgreSQL/SKILL.md](skills/skills/PostgreSQL/SKILL.md)             |
| **React + FastAPI** | AI UIs, Event Sources (SSE), websocket streaming, and proxy gateways.    | [React/SKILL.md](skills/skills/React/SKILL.md)                       |
| **Docker + K8s**    | Multi-stage image builds, liveness/readiness probes, and GPU scheduling. | [docker-k8s-mlops/SKILL.md](skills/skills/docker-k8s-mlops/SKILL.md) |
| **FastAPI**         | Clean API design, Pydantic validation, dependency injection, and auth.   | [fastapi_skill/SKILL.md](skills/skills/fastapi_skill/SKILL.md)       |
| **LLM Security**    | Securing LLM apps and agents against injection, jailbreaks, and excessive agency. | [llm_agent_security/SKILL.md](skills/skills/llm_agent_security/SKILL.md) |
| **MCP**             | Model Context Protocol spec (server tools, resources, and prompts).      | [mcp/SKILL.md](skills/skills/mcp/SKILL.md)                           |
| **Pydantic**        | Schema validation, settings management, and agentic workflows (PydanticAI).| [pydantic/SKILL.md](skills/skills/pydantic/SKILL.md)                 |
| **Unsloth Fine-Tuning** | Efficient LLM fine-tuning (LoRA/QLoRA) with minimized VRAM footprints. | [unsloth-finetuning/SKILL.md](skills/skills/unsloth-finetuning/SKILL.md) |

---

## 🔍 Detailed Skill Roundups & References

Click on any panel below to expand and view the reference blueprints and guidelines.

<details>
<summary><b>1. Data Structures & Algorithms (DSA in Java) Manual</b> (Click to expand)</summary>

- **Focus**: Complete guide to Data Structures and Algorithms conceptually and idiomatically in Java — from beginner fundamentals through FAANG-level problem solving.
- **Key Reference Docs**:
  - [java_fundamentals.md](skills/skills/DSA/references/java_fundamentals.md) — Java syntax, Collections Framework, generics, and Big-O notation.
  - [linear_structures.md](skills/skills/DSA/references/linear_structures.md) — Arrays, ArrayLists, LinkedLists, Stacks, and Queues.
  - [hashing.md](skills/skills/DSA/references/hashing.md) — HashTables, HashMap, HashSet, collision resolution, and custom keys.
  - [trees.md](skills/skills/DSA/references/trees.md) — Binary Trees, BSTs, AVL, Segment Trees, and tree traversals.
  - [graphs.md](skills/skills/DSA/references/graphs.md) — Adjacency lists/matrices, BFS, DFS, Dijkstra, Prim, and Kruskal.
  - [heaps.md](skills/skills/DSA/references/heaps.md) — PriorityQueue, Min-Heap, Max-Heap, and HeapSort.
  - [sorting_and_searching.md](skills/skills/DSA/references/sorting_and_searching.md) — QuickSort, MergeSort, Binary Search, and Two Pointers.
  - [recursion_and_backtracking.md](skills/skills/DSA/references/recursion_and_backtracking.md) — N-Queens, Subsets, Permutations, and recursive stack traces.
  - [dynamic_programming.md](skills/skills/DSA/references/dynamic_programming.md) — Memoization, Tabulation, 0/1 Knapsack, and LCS.
  - [greedy_algorithms.md](skills/skills/DSA/references/greedy_algorithms.md) — Activity Selection, Fractional Knapsack, and Huffman Coding.
  - [problem_solving_strategy.md](skills/skills/DSA/references/problem_solving_strategy.md) — Problem categorization, pattern recognition, and interview frameworks.
  - [learning_path.md](skills/skills/DSA/references/learning_path.md) — Step-by-step roadmap from beginner Java basics to FAANG-level problem solving.
</details>

<details>
<summary><b>2. LangChain Architect's Manual</b> (Click to expand)</summary>

- **Focus**: Replaces legacy `AgentExecutor` chains with middleware-extensible graph models using LangGraph and Deep Agents.
- **Key Reference Docs**:
  - [models.md](skills/skills/LangChain/references/MODELS.md) — Model initializations, streaming, and tool calling basics.
  - [agents.md](skills/skills/LangChain/references/AGENT.md) — Detailed configurations for single and multi-agent harnesses.
  - [memory.md](skills/skills/LangChain/references/MEMORY.md) — State management, checkpointers, and persistent session storage.
  - [middleware.md](skills/skills/LangChain/references/MIDDLEWARE.md) — Writing hooks to intercept tool execution and model requests.
  - [learning_path.md](skills/skills/LangChain/references/LearningPath.md) — Structured curriculum from beginner concepts to Production Graphs.
</details>

<details>
<summary><b>3. LlamaIndex Architect's Manual</b> (Click to expand)</summary>

- **Focus**: Data indexing and query retrievers. Optimizes loading documents via parsers and building advanced indexing strategies.
- **Key Reference Docs**:
  - [rag_fundamentals.md](skills/skills/Llamaindex/references/rag_fundamentals.md) — Fundamental steps of retrieval-augmented generation.
  - [loading_and_nodes.md](skills/skills/Llamaindex/references/loading_and_nodes.md) — Schema parsing, Ingestion pipelines, and custom node splitters.
  - [indexing_and_embeddings.md](skills/skills/Llamaindex/references/indexing_and_embeddings.md) — Vector, Summary, and advanced PropertyGraph indices.
  - [vector_databases.md](skills/skills/Llamaindex/references/vector_database.md) — Integration configurations for databases like ChromaDB, Pinecone, and pgvector.
  - [workflows.md](skills/skills/Llamaindex/references/workflows.md) — Event-driven loops, step functions, and concurrency control.
</details>

<details>
<summary><b>4. MongoDB Architect's Manual</b> (Click to expand)</summary>

- **Focus**: Optimized JSON document storage. Prioritizes queries when designing database schemas.
- **Key Reference Docs**:
  - [data_modeling.md](skills/skills/MongoDB/references/data_modeling.md) — Decisions criteria on when to embed nested data vs. join collections.
  - [indexes.md](skills/skills/MongoDB/references/indexes.md) — Setup guidelines for compound indexes (ESR rules).
  - [aggregation.md](skills/skills/MongoDB/references/aggregation.md) — Pipeline architecture, stages usage, and indexing integrations.
  - [mongoose.md](skills/skills/MongoDB/references/mongoose.md) — Schema layers, validations, and custom model middleware in Express apps.
</details>

<details>
<summary><b>5. PostgreSQL Architect's Manual</b> (Click to expand)</summary>

- **Focus**: Traditional relational mapping and SQL queries. Combines tabular schemas with hybrid unstructured columns.
- **Key Reference Docs**:
  - [datatypes_and_design.md](skills/skills/PostgreSQL/references/datatypes_and_design.md) — Structured schemas, identities, and `JSONB` documents.
  - [queries.md](skills/skills/PostgreSQL/references/queries.md) — Advanced analytics (window functions, subqueries, and CTE expressions).
  - [indexs_and_performance.md](skills/skills/PostgreSQL/references/indexs_and_performance.md) — B-trees, GIN indexes, and using `EXPLAIN ANALYZE` logs.
  - [transactions_and_concurrency.md](skills/skills/PostgreSQL/references/transactions_and_concurrency.md) — Row locking configurations and MVCC transactional states.
</details>

<details>
<summary><b>6. React + FastAPI AI Application Manual</b> (Click to expand)</summary>

- **Focus**: Structuring client-facing AI layouts. Develops clean event structures to display agent reasoning states.
- **Key Reference Docs**:
  - [streaming_and_llm_ui.md](skills/skills/React/references/streaming_and_llm_ui.md) — Client fetching protocols using SSE and WebSockets.
  - [chat_ui_patterns.md](skills/skills/React/references/chat_ui_patterns.md) — Rich text styling, scroll managers, and cancel hooks.
  - [agentic_ui_patterns.md](skills/skills/React/references/agentic_ui_patterns.md) — Interactive step logs, trace visualizations, and human-in-the-loop approvals.
  - [fastapi_ml_services.md](skills/skills/React/references/fastapi_ml_services.md) — Serving scikit-learn or PyTorch weight loads with FastAPI lifespans.
</details>

<details>
<summary><b>7. Docker + Kubernetes MLOps Manual</b> (Click to expand)</summary>

- **Focus**: Pipeline deployment. Coordinates scalable container layers for backend services and ML inference.
- **Key Reference Docs**:
  - [dockerfiles_for_ml.md](skills/skills/docker-k8s-mlops/references/dockerfiles_for_ml.md) — Multi-stage builds, dependencies caching, and image size constraints.
  - [probs_and_healing.md](skills/skills/docker-k8s-mlops/references/probs_and_healing.md) — Defining liveness/readiness thresholds to avoid weight loading timeouts.
  - [gpu_on_kubernetes.md](skills/skills/docker-k8s-mlops/references/gpu_on_kubernetes.md) — Device configurations, quotas scheduler, and node pools matching.
  - [cicd_and_gitops.md](skills/skills/docker-k8s-mlops/references/cicd_and_gitops.md) — Automatic rollback pipelines using GitOps operators.
</details>

<details>
<summary><b>8. FastAPI Expert Mentor</b> (Click to expand)</summary>

- **Focus**: Reusable backend layout with clean validation. Built around Pydantic schema validation.
- **Key Reference Docs**:
  - [DATABASE.md](skills/skills/fastapi_skill/referencs/DATABASE.md) — SQLAlchemy connection pipelines, Session handlers, and Alembic migrations.
  - [Auth.md](skills/skills/fastapi_skill/referencs/Auth.md) — OAuth2 authentication setups, JWT generation, and password hashing guards.
  - [TEST.md](skills/skills/fastapi_skill/referencs/TEST.md) — Writing pytest fixtures with db overrides and async network mocks.
  - [DEPLOYMENT.md](skills/skills/fastapi_skill/referencs/DEPLOYMENT.md) — Gunicorn/Uvicorn configurations, Docker wrapping, and production logs setup.
</details>

<details>
<summary><b>9. Model Context Protocol (MCP) Manual</b> (Click to expand)</summary>

- **Focus**: Flexible client-server communication. Exposes local resources and actions cleanly to any AI host.
- **Key Reference Docs**:
  - [tools_resource_prompts.md](skills/skills/mcp/references/tools_resource_prompts.md) — Customizing entry parameters and return schemas.
  - [building_servers.md](skills/skills/mcp/references/building_servers.md) — Setup protocols using FastMCP wrapper decorators.
  - [transports.md](skills/skills/mcp/references/transports.md) — Standard input/output streams vs. remote HTTP and ASGI mount pathways.
  - [security.md](skills/skills/mcp/references/security.md) — Mitigating sandbox escalations, prompt injections, and token poisoning.
</details>

<details>
<summary><b>10. Pydantic Architect's Manual</b> (Click to expand)</summary>

- **Focus**: Type-safe data validation, settings management, and AI agent development using Pydantic and PydanticAI.
- **Key Reference Docs**:
  - [validation_fundamentals.md](skills/skills/pydantic/references/validation_fundamentals.md) — BaseModels, field constraints, type coercion, and serialization.
  - [validators.md](skills/skills/pydantic/references/validators.md) — Custom field and model validators with before, after, and wrap modes.
  - [pydantic_ai_agents.md](skills/skills/pydantic/references/pydantic_ai_agents.md) — Type-safe AI agents with structured outputs, streaming, and multi-turn flows.
  - [tools_and_dependencies.md](skills/skills/pydantic/references/tools_and_dependencies.md) — Agent tools, typed dependency injection, RunContext, and retries.
  - [structured_outputs.md](skills/skills/pydantic/references/structured_outputs.md) — Validated LLM responses, validation retries, and output strategies.
  - [settings_management.md](skills/skills/pydantic/references/settings_management.md) — Environment variables loading and application configuration.
  - [learning_path.md](skills/skills/pydantic/references/learning_path.md) — Step-by-step track from basic schemas to production multi-agent systems.
</details>

<details>
<summary><b>11. LLM & Agent Security Manual</b> (Click to expand)</summary>

- **Focus**: Layered defense model for securing LLMs and autonomous agents against prompt injection, jailbreaks, excessive agency, and tool/memory poisoning.
- **Key Reference Docs**:
  - [threat_landscape.md](skills/skills/llm_agent_security/references/threat_landscape.md) — OWASP Top 10 for LLM/Agentic apps, MITRE ATLAS framework, and security scoring.
  - [prompt_injection.md](skills/skills/llm_agent_security/references/prompt_injection.md) — Attack surfaces (direct/indirect injection) and defense mechanisms.
  - [jailbreaks.md](skills/skills/llm_agent_security/references/jailbreaks.md) — Jailbreak tactics (roleplay, encoding, multi-turn crescendo) and mitigation.
  - [guardrails.md](skills/skills/llm_agent_security/references/guardrails.md) — Production runtime defenses using NeMo Guardrails, Guardrails AI, and LLM Guard.
  - [agentic_risks.md](skills/skills/llm_agent_security/references/agentic_risks.md) — Specific threats to autonomous agents like tool and memory poisoning.
  - [least_privilege_architecture.md](skills/skills/llm_agent_security/references/least_privilege_architecture.md) — Securing agents through sandboxing, scoped API keys, and human-in-the-loop approvals.
  - [output_handling.md](skills/skills/llm_agent_security/references/output_handling.md) — Sanitizing LLM outputs to prevent downstream SQLi, XSS, and PII leakage.
  - [red_teaming.md](skills/skills/llm_agent_security/references/red_teaming.md) — Adversarial pre-deployment testing using Garak, PyRIT, and Promptfoo.
  - [rag_and_mcp_security.md](skills/skills/llm_agent_security/references/rag_and_mcp_security.md) — Securing MCP server endpoints and data retrieval vector pipelines.
  - [governance_and_monitoring.md](skills/skills/llm_agent_security/references/governance_and_monitoring.md) — Compliance standards, NIST AI Risk Management Framework, and production logs.
  - [learning_path.md](skills/skills/llm_agent_security/references/learning_path.md) — Sequential roadmap from security fundamentals to enterprise security architecture.
</details>

<details>
<summary><b>12. Unsloth Fine-Tuning Manual</b> (Click to expand)</summary>

- **Focus**: Complete guide to efficient fine-tuning of LLMs using Unsloth (LoRA/QLoRA) with minimized VRAM footprint.
- **Key Reference Docs**:
  - [setup_and_models.md](skills/skills/unsloth-finetuning/references/setup_and_models.md) — Installing Unsloth, base model selection, and VRAM requirement planning.
  - [dataset_preparation.md](skills/skills/unsloth-finetuning/references/dataset_preparation.md) — Chat templates, instruction formatting, and train/eval splits.
  - [lora_hyperparameters.md](skills/skills/unsloth-finetuning/references/lora_hyperparameters.md) — LoRA rank, alpha, dropout, target modules, and DoRA.
  - [training.md](skills/skills/unsloth-finetuning/references/training.md) — SFTTrainer configuration, learning rates, batch sizes, and gradient checkpointing.
  - [evaluation.md](skills/skills/unsloth-finetuning/references/evaluation.md) — Qualitative/quantitative validation and catastrophic forgetting mitigation.
  - [export_and_deployment.md](skills/skills/unsloth-finetuning/references/export_and_deployment.md) — Model merging, GGUF/Ollama export, and deployment with vLLM.
  - [troubleshooting.md](skills/skills/unsloth-finetuning/references/troubleshooting.md) — Common error resolution, OOM fixes, and chat template alignment.
  - [advances_techniques.md](skills/skills/unsloth-finetuning/references/advances_techniques.md) — Preference tuning (DPO), multimodal tuning, and advanced PEFT.
  - [learning_path.md](skills/skills/unsloth-finetuning/references/learning_path.md) — Structured curriculum from beginner concepts to advanced fine-tuning models.
</details>

---

## 🧭 How to Consult & Use the Skills

To query a specific skill or build a project using these guides, follow the standard workflow:

```mermaid
graph TD
    User([User Request / Task]) --> Route{Identify Domain}
    Route -->|DSA / Java Algorithms| DSA[Read DSA/SKILL.md]
    Route -->|LangChain agent| LC[Read LangChain/SKILL.md]
    Route -->|RAG pipeline| LI[Read Llamaindex/SKILL.md]
    Route -->|DB Schema / Query| DB[Read MongoDB/SKILL.md or PostgreSQL/SKILL.md]
    Route -->|Frontend / Gateway| FE[Read React/SKILL.md]
    Route -->|Deployment / Infra| OPS[Read docker-k8s-mlops/SKILL.md]
    Route -->|API Business Logic| API[Read fastapi_skill/SKILL.md]
    Route -->|LLM Security / Safety| SEC[Read llm_agent_security/SKILL.md]
    Route -->|AI Tooling spec| MCP[Read mcp/SKILL.md]
    Route -->|Schema / PydanticAI| PY[Read pydantic/SKILL.md]
    Route -->|LLM Fine-tuning / LoRA| UF[Read unsloth-finetuning/SKILL.md]

    DSA --> Consult[Consult references/ directory for targeted blueprints & guidelines]
    LC --> Consult
    LI --> Consult
    DB --> Consult
    FE --> Consult
    OPS --> Consult
    API --> Consult
    SEC --> Consult
    MCP --> Consult
    PY --> Consult
    UF --> Consult
```

1. **Check the Entrypoint**: Start by reading the root `SKILL.md` of the relevant folder. It holds best practices, quick install setup commands, and a code stub.
2. **Follow the Routing Map**: Look at the table inside `SKILL.md` to find the exact reference file. For example, if you need help with **Pydantic Validation** in FastAPI, the route redirects you to `referencs/DATABASE.md`.
3. **Execute and Verify**: Test your implementations against the best practices summarized in each entrypoint, utilizing the learning paths to resolve any troubleshooting issues.
