# Connecting Pydantic AI to FastAPI

## Why this combination is a natural fit

FastAPI's core design — Python type hints as the source of truth for validation,
serialization, and auto-generated docs — is exactly the philosophy Pydantic AI
applies to agents. Request/response models, agent dependencies, and agent
structured outputs can all be **the same Pydantic models**, reused end-to-end from
HTTP boundary through agent execution to HTTP response, with no translation layer
in between.

## The minimal pattern

```python
from fastapi import FastAPI
from pydantic import BaseModel
from pydantic_ai import Agent

app = FastAPI()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

agent = Agent("claude-sonnet-4-6", system_prompt="You are a helpful assistant.")

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    result = await agent.run(request.message)
    return ChatResponse(reply=result.output)
```

Note `await agent.run(...)`, not `run_sync` — inside an async FastAPI endpoint,
always use the async `run` method (see `pydantic_ai_agents.md`) to avoid blocking
the event loop.

## Dependency injection — FastAPI's `Depends` + Pydantic AI's `deps_type`, together

These are two distinct dependency injection systems that compose cleanly — FastAPI
injects request-scoped dependencies (DB sessions, the authenticated user) into your
route handler; you then pass exactly what the agent needs into its own
`deps_type` container.

```python
from dataclasses import dataclass
from fastapi import FastAPI, Depends
from pydantic_ai import Agent, RunContext

@dataclass
class AgentDeps:
    user_id: int
    db: "AsyncSession"

agent = Agent("claude-sonnet-4-6", deps_type=AgentDeps)

@agent.tool
async def get_user_orders(ctx: RunContext[AgentDeps]) -> list[dict]:
    """Get the current user's order history."""
    return await fetch_orders(ctx.deps.db, ctx.deps.user_id)

async def get_db_session():
    async with AsyncSessionLocal() as session:
        yield session

@app.post("/api/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),   # FastAPI's own DI
    db: AsyncSession = Depends(get_db_session),          # FastAPI's own DI
):
    deps = AgentDeps(user_id=current_user.id, db=db)     # feeds into Pydantic AI's DI
    result = await agent.run(request.message, deps=deps)
    return {"reply": result.output}
```

## Multi-turn conversations — persisting `message_history`

```python
from fastapi import FastAPI
from pydantic_ai.messages import ModelMessagesTypeAdapter
import json

@app.post("/api/chat/{conversation_id}")
async def chat(conversation_id: str, request: ChatRequest, db: AsyncSession = Depends(get_db_session)):
    stored = await get_conversation_history(db, conversation_id)
    message_history = ModelMessagesTypeAdapter.validate_python(stored) if stored else []

    result = await agent.run(request.message, message_history=message_history)

    await save_conversation_history(
        db, conversation_id,
        ModelMessagesTypeAdapter.dump_python(result.all_messages())
    )
    return {"reply": result.output}
```

Since Pydantic AI doesn't manage session state implicitly (see
`pydantic_ai_agents.md`), persisting `result.all_messages()` to your database
between requests — and reloading it as `message_history` on the next request — is
the standard pattern for a real multi-turn chat API.

## Streaming — SSE endpoint

```python
from fastapi.responses import StreamingResponse
import json

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async with agent.run_stream(request.message) as result:
            async for chunk in result.stream_text(delta=True):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

`stream_text(delta=True)` yields only the incremental new text per chunk (rather
than the cumulative text-so-far) — the right choice for typical token-by-token SSE
streaming into a chat UI. This SSE endpoint shape is identical to the pattern in
this skill collection's `react-ai-architect` skill (`streaming_llm_ui.md`) — the
frontend consumption code is unchanged regardless of which agent framework
produces the stream.

## Streaming with structured tool-call events (for agentic UIs)

```python
import json
from pydantic_ai import Agent

@app.post("/api/agent/stream")
async def agent_stream(request: ChatRequest):
    async def generate():
        async with agent.iter(request.message) as agent_run:
            async for node in agent_run:
                if Agent.is_call_tools_node(node):
                    async with node.stream(agent_run.ctx) as tools_stream:
                        async for event in tools_stream:
                            if event.event_kind == "function_tool_call":
                                yield f"event: tool_call_start\ndata: {json.dumps({'name': event.part.tool_name, 'args': event.part.args})}\n\n"
                            elif event.event_kind == "function_tool_result":
                                yield f"event: tool_call_result\ndata: {json.dumps({'result': str(event.result.content)})}\n\n"
                elif Agent.is_model_request_node(node):
                    async with node.stream(agent_run.ctx) as request_stream:
                        async for event in request_stream:
                            if hasattr(event, "delta") and hasattr(event.delta, "content_delta"):
                                yield f"event: token\ndata: {json.dumps({'text': event.delta.content_delta})}\n\n"
        yield "event: done\ndata: {}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

This translates Pydantic AI's fine-grained execution events into the same
structured SSE event schema (`token`/`tool_call_start`/`tool_call_result`/`done`)
used throughout the `react-ai-architect` skill's `agentic_ui_patterns.md` — the
frontend's agentic-UI rendering code works identically whether the backend agent
is built with Pydantic AI, LangChain, or hand-rolled, as long as the event schema
contract is consistent.

## WebSocket streaming (the alternative transport)

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            async with agent.run_stream(data["message"]) as result:
                async for chunk in result.stream_text(delta=True):
                    await websocket.send_json({"type": "token", "text": chunk})
            await websocket.send_json({"type": "done"})
    except WebSocketDisconnect:
        pass
```

See `react-ai-architect`'s `streaming_llm_ui.md` for the SSE-vs-WebSocket decision
criteria — that guidance applies identically regardless of which agent framework
is producing the stream.

## A full production-shaped endpoint

```python
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    message: str
    conversation_id: str

@app.post("/api/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        stored_history = await get_conversation_history(db, request.conversation_id)
        message_history = ModelMessagesTypeAdapter.validate_python(stored_history) if stored_history else []

        deps = AgentDeps(user_id=current_user.id, db=db)
        result = await agent.run(request.message, deps=deps, message_history=message_history)

        await save_conversation_history(
            db, request.conversation_id,
            ModelMessagesTypeAdapter.dump_python(result.all_messages())
        )
        return {"reply": result.output}
    except Exception as e:
        raise HTTPException(500, f"Agent execution failed: {e}")
```

This combines: FastAPI request validation, FastAPI's own dependency injection for
auth/DB, Pydantic AI's dependency injection for agent tools, persisted multi-turn
history, and error handling — the realistic shape of a production chat endpoint.

## Practical guidance

1. **Always use `await agent.run(...)`, never `run_sync`, inside FastAPI
   endpoints** — this is an async context, and `run_sync` blocks the event loop.
2. **Compose FastAPI's `Depends` with Pydantic AI's `deps_type`** — they're two
   distinct, complementary DI systems, not competing ones.
3. **Persist `result.all_messages()` explicitly** for multi-turn conversations —
   Pydantic AI has no implicit session state.
4. **Reuse the same Pydantic models across the HTTP boundary and the agent
   boundary** where it makes sense — this is the actual "FastAPI feeling" payoff.
5. **When streaming to an agentic frontend, translate Pydantic AI's execution
   events into the same structured SSE schema** you'd use for any other agent
   framework — the frontend contract should stay framework-agnostic.