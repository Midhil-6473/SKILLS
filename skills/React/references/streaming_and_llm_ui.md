# Streaming LLM Responses into React — SSE, WebSockets, Fetch Streaming

## Why streaming matters

When an LLM takes 5-15+ seconds to generate a complete response, showing a blank
loading spinner the whole time is a broken experience — users can't tell if it's
working, can't start reading, and often assume it's frozen. Token-by-token streaming
(the ChatGPT/Claude pattern) is the baseline expectation, not a nice-to-have.

## Choosing a transport: SSE vs WebSockets vs raw fetch streaming

| Transport | Direction | Best for |
|---|---|---|
| **SSE (Server-Sent Events)** | Server → client only | Most LLM chat UIs — simpler, works over plain HTTP/1.1, easy to proxy/load-balance, browser's `EventSource` handles auto-reconnection |
| **WebSockets** | Bidirectional | Enterprise chat needing instant mid-stream cancellation (stopping server-side generation, not just the client display), or genuinely bidirectional agent interaction |
| **Raw fetch streaming** (`response.body.getReader()`) | Server → client, but via a normal `fetch` call | When you need POST with a body (standard `EventSource` only supports GET) and don't want a WebSocket — the most common real-world choice for chat since conversation history must go in the request body |

**Practical default: use `fetch` + `ReadableStream` reading SSE-formatted text**,
since standard `EventSource` doesn't support POST requests, and virtually every chat
UI needs to POST the conversation history.

## Backend: FastAPI SSE endpoint

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import anthropic

app = FastAPI()
client = anthropic.Anthropic()

class ChatRequest(BaseModel):
    messages: list[dict]

async def stream_response(messages: list[dict]):
    with client.messages.stream(
        model="claude-sonnet-4-6", max_tokens=1024, messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield f"data: {text}\n\n"   # SSE format: "data: <content>\n\n"
    yield "data: [DONE]\n\n"

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    return StreamingResponse(stream_response(request.messages), media_type="text/event-stream")
```

### Using FastAPI's native SSE support (0.135.0+)

```python
from fastapi.responses import EventSourceResponse
from collections.abc import AsyncIterable

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest) -> EventSourceResponse:
    async def event_generator() -> AsyncIterable[str]:
        with client.messages.stream(model="claude-sonnet-4-6", max_tokens=1024, messages=request.messages) as stream:
            for text in stream.text_stream:
                yield text
    return EventSourceResponse(event_generator())
```

`EventSourceResponse` (native since FastAPI 0.135.0, or via `sse-starlette` on older
versions) handles SSE formatting automatically — prefer it over hand-rolling
`data: ...\n\n` strings when available.

### Structured events for agentic apps (not just raw text)

```python
import json

async def agent_event_stream(messages: list[dict]):
    yield f"event: start\ndata: {json.dumps({'status': 'thinking'})}\n\n"

    async for event in run_agent(messages):  # your agent loop
        if event.type == "tool_call":
            yield f"event: tool_call\ndata: {json.dumps({'name': event.name, 'args': event.args})}\n\n"
        elif event.type == "token":
            yield f"event: token\ndata: {json.dumps({'text': event.text})}\n\n"
        elif event.type == "tool_result":
            yield f"event: tool_result\ndata: {json.dumps({'name': event.name, 'result': event.result})}\n\n"

    yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"
```

Named events (`event: tool_call`, `event: token`) let the frontend distinguish event
types cleanly — critical for agentic UIs (see `agentic_ui_patterns.md`) where you need
to render more than a flat stream of text.

## Frontend: consuming an SSE stream with `fetch`

```jsx
async function streamChat(messages, onToken, onDone) {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop();  // keep incomplete last chunk for next iteration

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") { onDone(); return; }
        onToken(data);
      }
    }
  }
  onDone();
}
```

```jsx
function ChatInput() {
  const [messages, setMessages] = useState([]);

  const sendMessage = async (userText) => {
    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages([...newMessages, { role: "assistant", content: "" }]);

    await streamChat(
      newMessages,
      (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + token,
          };
          return updated;
        });
      },
      () => console.log("Stream complete")
    );
  };
  // ... render
}
```

**Note the functional update form** (`setMessages((prev) => ...)`) inside the token
callback — this callback fires many times per second during streaming, and using the
functional form avoids stale-closure bugs.

## Using `@microsoft/fetch-event-source` for a cleaner API

```bash
npm install @microsoft/fetch-event-source
```

```jsx
import { fetchEventSource } from "@microsoft/fetch-event-source";

await fetchEventSource("/api/chat/stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages }),
  onmessage(event) {
    if (event.event === "token") {
      const { text } = JSON.parse(event.data);
      appendToken(text);
    } else if (event.event === "tool_call") {
      const toolCall = JSON.parse(event.data);
      showToolCall(toolCall);
    }
  },
  onerror(err) {
    console.error("Stream error:", err);
    throw err;  // rethrow to stop retrying, or don't to let it auto-retry
  },
});
```

This library gives an `EventSource`-like API (named events, auto-reconnect) while
still supporting POST — generally nicer than hand-parsing raw `fetch` streams once
your event schema (token/tool_call/tool_result/done) gets non-trivial.

## Cancellation ("Stop generating" button)

```jsx
function ChatInput() {
  const controllerRef = useRef(null);

  const sendMessage = async (text) => {
    controllerRef.current = new AbortController();
    await fetchEventSource("/api/chat/stream", {
      method: "POST", body: JSON.stringify({ messages: [...] }),
      signal: controllerRef.current.signal,
      onmessage(event) { /* ... */ },
    });
  };

  const stopGenerating = () => controllerRef.current?.abort();

  return <button onClick={stopGenerating}>Stop generating</button>;
}
```

**Important limitation with SSE:** aborting the client-side fetch stops the client
from *receiving* more tokens, but the FastAPI generator may keep running server-side
(and the LLM provider keeps burning tokens/cost) until it separately detects the
disconnect. For true server-side cancellation on stop, either:
- Rely on FastAPI/Starlette's automatic disconnect detection (catches
  `GeneratorExit`/`CancelledError` in the async generator — clean up there), or
- Use WebSockets if you need guaranteed, immediate server-side generation halt as a
  hard product requirement (see the enterprise pattern below).

```python
async def stream_response(messages: list[dict]):
    try:
        with client.messages.stream(model="claude-sonnet-4-6", messages=messages) as stream:
            for text in stream.text_stream:
                yield f"data: {text}\n\n"
    except (GeneratorExit, asyncio.CancelledError):
        # Client disconnected — clean up (e.g., stop the underlying LLM call if supported)
        raise
```

## WebSockets — when SSE isn't enough

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            async for token in generate_stream(data["messages"]):
                await websocket.send_json({"type": "token", "text": token})
            await websocket.send_json({"type": "done"})
    except WebSocketDisconnect:
        pass  # client disconnected — clean up any active generation task
```

```jsx
function useChatWebSocket(url) {
  const wsRef = useRef(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    wsRef.current = new WebSocket(url);
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "token") { /* append token */ }
    };
    return () => wsRef.current?.close();
  }, [url]);

  const send = (messages) => wsRef.current?.send(JSON.stringify({ messages }));
  return { send };
}
```

**Choose WebSockets over SSE when:** you need true bidirectional communication (the
client sends control messages mid-stream, not just at the start), or instant
mid-generation cancellation is a hard product requirement (enterprise chat with heavy
per-token cost sensitivity) — the trade-off is materially more client-side complexity
(reconnection logic, message framing) for a benefit that most consumer-facing chat
apps don't actually need.

## Practical guidance

1. **Default to SSE via `fetch` + `ReadableStream`** (or `fetch-event-source`) for
   chat UIs — it covers the overwhelming majority of real use cases with less
   complexity than WebSockets.
2. **Use named SSE events** (`event: token`, `event: tool_call`) rather than a flat
   text stream the moment your app has more than one kind of update to show —
   virtually guaranteed once you add any agentic behavior.
3. **Always implement a "Stop generating" control** backed by `AbortController` —
   users expect this from every modern chat interface.
4. **Batch state updates during streaming** if you notice jank on very fast token
   streams — accumulate several tokens in a ref and flush via
   `requestAnimationFrame` rather than calling `setState` on every single token.
5. **Reach for WebSockets only when you have a concrete requirement** SSE can't meet
   — don't default to the more complex transport without a specific reason.