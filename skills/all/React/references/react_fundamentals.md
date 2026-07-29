# React Fundamentals — Through an AI-App Lens

## Why React for AI apps

React's component model and hooks map cleanly onto the shapes AI apps need:
incrementally-updating UI (streaming tokens), async data fetching (inference calls),
and complex, evolving local state (a conversation, an agent's step history). This file
assumes basic React familiarity and focuses on the patterns that come up constantly in
AI-facing frontends.

## Project setup

```bash
npm create vite@latest my-ai-app -- --template react-ts
cd my-ai-app
npm install
npm run dev
```

Vite is the standard modern choice — fast HMR matters when you're iterating quickly
on a streaming UI, where full-page reloads make debugging painful.

## `useState` for conversation/session state

```jsx
function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async () => {
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    // ... call backend, stream response (see streaming_llm_ui.md)
  };

  return (
    <div>
      {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={sendMessage} disabled={isStreaming}>Send</button>
    </div>
  );
}
```

**Critical pattern:** always use the **functional update form** (`setMessages((prev)
=> [...prev, newMsg])`) rather than referencing `messages` directly, especially
inside streaming callbacks — closures over stale state are the single most common bug
in streaming chat UIs, since the streaming callback fires many times and each closure
would otherwise "see" the state as of when the stream started, not the latest value.

## `useEffect` for data fetching (non-streaming)

```jsx
function PredictionResult({ input }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setResult)
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => setLoading(false));

    return () => controller.abort();  // cancel in-flight request on unmount/re-run
  }, [input]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;
  return <ResultCard result={result} />;
}
```

**Always return the `AbortController.abort()` cleanup function** — without it, a fast
user triggering multiple predictions in a row can get race conditions where an older,
slower request resolves after a newer one and overwrites the correct result.

## Custom hooks — encapsulating AI-specific logic

Extracting a `usePrediction` or `useChatStream` hook keeps components focused on
rendering, not networking:

```jsx
function usePrediction(input) {
  const [state, setState] = useState({ result: null, loading: false, error: null });

  useEffect(() => {
    if (!input) return;
    const controller = new AbortController();
    setState({ result: null, loading: true, error: null });

    fetch("/api/predict", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input), signal: controller.signal,
    })
      .then((res) => res.json())
      .then((result) => setState({ result, loading: false, error: null }))
      .catch((error) => {
        if (error.name !== "AbortError") setState({ result: null, loading: false, error: error.message });
      });

    return () => controller.abort();
  }, [input]);

  return state;
}

// Usage: const { result, loading, error } = usePrediction(formData);
```

This is the pattern you'll reuse constantly — build one custom hook per "kind" of AI
call your app makes (prediction, chat stream, agent run, file analysis).

## `useRef` for streaming buffers and DOM access

```jsx
function StreamingMessage({ stream }) {
  const contentRef = useRef("");
  const [displayContent, setDisplayContent] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    // Accumulate into a ref (avoids re-render per token if you want to batch)
    // then flush to state, e.g. via requestAnimationFrame for smooth rendering
  }, [stream]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayContent]);

  return <div ref={scrollRef}>{displayContent}</div>;
}
```

`useRef` is useful for two AI-UI-specific needs: (1) accumulating streamed text
without triggering a re-render on every single token (batch and flush instead), and
(2) auto-scroll-to-bottom behavior in chat interfaces.

## `useReducer` for complex agent/conversation state

Once state transitions get complex (a conversation with tool calls, retries,
streaming status, and errors all interacting), `useReducer` beats scattered
`useState` calls:

```jsx
function chatReducer(state, action) {
  switch (action.type) {
    case "SEND_MESSAGE":
      return { ...state, messages: [...state.messages, action.message], status: "streaming" };
    case "APPEND_TOKEN":
      return {
        ...state,
        messages: state.messages.map((m, i) =>
          i === state.messages.length - 1 ? { ...m, content: m.content + action.token } : m
        ),
      };
    case "TOOL_CALL_START":
      return { ...state, activeToolCalls: [...state.activeToolCalls, action.toolCall] };
    case "STREAM_DONE":
      return { ...state, status: "idle" };
    case "ERROR":
      return { ...state, status: "error", error: action.error };
    default:
      return state;
  }
}

const [state, dispatch] = useReducer(chatReducer, {
  messages: [], status: "idle", activeToolCalls: [], error: null,
});
```

This scales far better than a dozen `useState` calls once you're handling streaming
text + tool call events + errors + retry logic simultaneously — see
`agentic_ui_patterns.md`.

## Memoization for expensive renders

```jsx
const MessageList = React.memo(function MessageList({ messages }) {
  return messages.map((m) => <MessageBubble key={m.id} message={m} />);
});

const parsedMarkdown = useMemo(() => parseMarkdown(message.content), [message.content]);
```

Markdown/code-block parsing (very common in AI chat responses — see
`chat_ui_patterns.md`) is a legitimate `useMemo` candidate: re-parsing the same
completed message on every unrelated re-render is wasted work, especially for long
technical responses with multiple code blocks.

## Suspense and `use()` for async data (React 19+)

```jsx
function ChatMessages({ messagesPromise }) {
  const messages = use(messagesPromise);  // suspends until resolved
  return messages.map((m) => <MessageBubble key={m.id} message={m} />);
}

<Suspense fallback={<Spinner />}>
  <ChatMessages messagesPromise={fetchHistory()} />
</Suspense>
```

Useful for loading conversation history on mount — less useful for the token-by-token
streaming case itself, where manual state management (above) gives finer control over
partial/incremental rendering than Suspense's all-or-nothing resolution model.

## Practical guidance

1. **Start with `useState` + `useEffect`**; reach for `useReducer` only once state
   transitions genuinely tangle together (streaming + tool calls + errors).
2. **Always clean up in-flight requests** with `AbortController` in `useEffect`
   cleanup — this matters more in AI apps than typical CRUD apps because inference/LLM
   calls are slow enough for races to actually happen in practice.
3. **Extract custom hooks per AI-call type** (`usePrediction`, `useChatStream`,
   `useAgentRun`) to keep components declarative and testable.
4. **Memoize markdown/syntax-highlighting parses** — these are the most common
   accidental performance bottleneck in AI chat UIs with long technical responses.