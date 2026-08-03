# Beginner → Advanced Learning Path (Pydantic Validation + Pydantic AI)

Use this as a curriculum when the user wants a structured roadmap rather than a
point answer. Each phase names the reference file(s) to pull detail from.

## Phase 0 — Orientation (15 minutes)

- Understand why type hints alone aren't validation, and where Pydantic earns its
  keep (data crossing a trust boundary). See `SKILL.md`.
- Understand the two-part scope of this skill: Pydantic Validation (the data
  library) and Pydantic AI (the agent framework) — related, but distinct tools.
- Install: `pip install pydantic` and `pip install pydantic-ai`.

**Practice:** Run the two quick-start snippets from `SKILL.md` — one plain
validation model, one minimal agent.

## Phase 1 — Validation Fundamentals

*Read: `validation_fundamentals.md`*

1. Define a `BaseModel` with a few fields, observe automatic type coercion.
2. Add `Field()` constraints (`gt`, `min_length`, etc.) and trigger a
   `ValidationError` deliberately to see the error format.
3. Nest one model inside another; confirm recursive validation.
4. Practice `model_dump()`, `model_dump_json()`, and `exclude_unset=True`.

**Practice project:** Model a small "product catalog" schema (Product, Category,
nested) with realistic constraints, and validate a few sample dict payloads
against it.

## Phase 2 — Validators

*Read: `validators.md`*

1. Write a `@field_validator` that transforms a value (not just rejects).
2. Write a `@model_validator(mode="after")` enforcing a cross-field business rule.
3. Try `mode="before"` for messy input normalization.
4. Attach a reusable validator via `Annotated` + `AfterValidator`.

**Practice project:** Add a `@model_validator` to your Phase 1 catalog schema
enforcing a real cross-field rule (e.g., "discounted_price must be less than
price"), and a `@field_validator` normalizing a field (e.g., lowercasing a SKU).

## Phase 3 — Settings Management

*Read: `settings_management.md`*

1. Build a `BaseSettings` class for a small app's configuration.
2. Load from a `.env` file; confirm a missing required field fails loudly at
   startup.
3. Add nested settings with `env_nested_delimiter`.
4. Use `SecretStr` for a fake API key field.

**Practice project:** Replace any `os.environ` usage in a personal project with a
proper `pydantic-settings` model.

## Phase 4 — Pydantic AI Fundamentals

*Read: `pydantic_ai_agents.md`*

1. Build a minimal agent with a plain string output.
2. Add `output_type` with a small Pydantic model; observe `result.output` is a
   real validated instance.
3. Try both `run_sync` and `run` (async); understand when to use each.
4. Pass `message_history` between two `run_sync` calls for a basic multi-turn
   exchange.

**Practice project:** Build a small "receipt extractor" agent — plain text input,
structured `Receipt` (vendor, total, items) as `output_type`.

## Phase 5 — Tools and Dependency Injection

*Read: `tools_and_dependencies.md`*

1. Add an `@agent.tool_plain` function to an agent.
2. Convert it to `@agent.tool` with a `deps_type` dataclass and `RunContext`.
3. Write a test that injects mock dependencies — no monkeypatching.
4. Add a `ModelRetry` for a recoverable tool failure case.

**Practice project:** Extend your Phase 4 agent with a tool that "looks up" a
customer record from a mock dependency (a fake in-memory dict standing in for a
database), and write a test using mock deps.

## Phase 6 — Structured Outputs in Depth

*Read: `structured_outputs.md`*

1. Deliberately under-specify a schema to trigger a validation retry; observe the
   behavior.
2. Build a `Union` of two `Literal`-discriminated output models for a
   success/error branch.
3. Add a `@field_validator` to an output model and confirm it participates in
   the retry-on-failure loop.

**Practice project:** Give your receipt extractor a discriminated union output —
`ExtractedReceipt` on success, `ExtractionFailed` with a reason on failure — and
branch your application code on the result.

## Phase 7 — Multi-Agent Workflows

*Read: `multi_agent_workflows.md`*

1. Build a simple manual-delegation pattern — one agent's tool calls a second
   agent.
2. Build a small `pydantic-graph` with at least one loop (a review→revise cycle).
3. Read (without necessarily building) the LangGraph comparison — know when
   you'd reach for it instead.

**Practice project:** Build a two-step research→write pipeline, first as manual
delegation, then reimplemented as a `pydantic-graph` with a revision loop.

## Phase 8 — FastAPI Integration

*Read: `fastapi_integration.md`*

1. Wire your Phase 4-6 agent into a FastAPI `/chat` endpoint using `await
   agent.run(...)`.
2. Compose FastAPI's `Depends` with the agent's `deps_type`.
3. Add conversation persistence (`message_history` saved/reloaded from a database
   or even just an in-memory dict for practice).
4. Add an SSE streaming endpoint using `run_stream`.

**Practice project:** Turn your receipt extractor into a real FastAPI endpoint
with request/response models, then add a second endpoint that streams a
conversational agent's response token-by-token.

## Phase 9 — Framework Integration

*Read: `framework_integration.md`*

1. Read the honest Pydantic AI vs. LangChain vs. LangGraph comparison and form a
   view on which fits a project you're currently working on.
2. Try connecting an agent to an MCP server via `MCPServerStdio` (see this
   collection's `mcp-architect` skill for building the server side).
3. If you use LangChain elsewhere, notice where Pydantic Validation is already
   underneath its structured output features.

**Practice project:** Connect your FastAPI agent to a simple local MCP server
(e.g., a small filesystem or notes server) using Pydantic AI's built-in MCP
support.

## Phase 10 — Observability and Evals

*Read: `observability_and_evals.md`*

1. Add `logfire.instrument_pydantic_ai()` to your project and inspect a trace.
2. Build a small `pydantic_evals.Dataset` with 3-5 representative test cases for
   your agent.
3. Add an `LLMJudge` evaluator for one open-ended case.

**Practice project:** Write an eval suite for your receipt extractor covering a
clean case, an ambiguous case, and a malformed-input case — then wire a simple
pass-rate check that could gate a CI pipeline (see this collection's
`docker-k8s-mlops` skill for the surrounding CI/CD context).

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. a working engineer with a
specific production task):
- Build one cumulative project (the receipt/document extractor is a good
  default) across all phases rather than disconnected examples.
- Emphasize Phase 5 (dependency injection) even in a toy project — the testing
  benefit is one of Pydantic AI's most genuinely distinguishing features and is
  worth internalizing early, not just reading about.
- Check understanding with a quick build before advancing — e.g., "before adding
  structured output, want to try triggering a `ValidationError` on purpose and
  reading the error message closely?"
- Be upfront about Pydantic AI's current multi-agent limitations (Phase 7) rather
  than letting a learner discover them after committing to an architecture that
  needs built-in handoff primitives.