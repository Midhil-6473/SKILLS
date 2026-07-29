# Chat UI Patterns — Message Lists, Markdown, Auto-Scroll, Controls

## The anatomy of a chat interface

```
┌─────────────────────────────┐
│  Message list (scrollable)  │ ← auto-scrolls to bottom on new content
│   [user bubble]              │
│   [assistant bubble, w/      │
│    markdown/code rendering]  │
├─────────────────────────────┤
│  Input box + Send button     │ ← disabled while streaming, "Stop" appears instead
└─────────────────────────────┘
```

## Message data model

```ts
type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status?: "streaming" | "complete" | "error";
  toolCalls?: ToolCall[];   // see agentic_ui_patterns.md
  createdAt: number;
};
```

Give every message a stable `id` (not array index) — required for correct React
`key` usage, especially once messages can be edited, regenerated, or reordered.

## Rendering markdown and code blocks

LLM responses are almost always markdown-formatted, frequently containing code
blocks that need syntax highlighting.

```bash
npm install react-markdown remark-gfm react-syntax-highlighter
```

```jsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function MessageContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>{children}</code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**Performance note:** wrap this in `React.memo` and only re-render when `content`
actually changes for *that specific* message — re-parsing markdown on every token for
a long response is a real, commonly-hit performance issue.

```jsx
const MessageContent = React.memo(function MessageContent({ content }) {
  // ... as above
}, (prevProps, nextProps) => prevProps.content === nextProps.content);
```

### Streaming markdown safely (incomplete syntax mid-stream)

A subtlety specific to AI chat: while streaming, `content` is often an **incomplete**
markdown string (e.g., an unclosed code fence). Most markdown renderers handle this
gracefully by treating unclosed blocks as still-open, but test this explicitly with
your chosen library — a common bug is content "jumping" or flickering as a code fence
opens/closes across streamed chunks.

## Auto-scroll to bottom

```jsx
function MessageList({ messages }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setAutoScroll(isNearBottom);
  };

  return (
    <div ref={containerRef} onScroll={handleScroll} style={{ overflowY: "auto" }}>
      {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
      <div ref={bottomRef} />
    </div>
  );
}
```

**Critical UX detail:** disable auto-scroll once the user manually scrolls up to read
earlier content — nothing is more frustrating than the view yanking back to the
bottom mid-stream while you're trying to read something above. Re-enable auto-scroll
only once the user scrolls back near the bottom themselves.

## Input box behavior during streaming

```jsx
function ChatInput({ onSend, onStop, isStreaming }) {
  const [text, setText] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || isStreaming) return;
    onSend(text);
    setText("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
        }}
        disabled={isStreaming}
        placeholder="Send a message..."
      />
      {isStreaming ? (
        <button type="button" onClick={onStop}>Stop</button>
      ) : (
        <button type="submit" disabled={!text.trim()}>Send</button>
      )}
    </form>
  );
}
```

Standard conventions: `Enter` sends, `Shift+Enter` inserts a newline; the send button
becomes a stop button during streaming rather than just disabling.

## Regenerate / edit / branch

```jsx
function MessageActions({ message, onRegenerate, onEdit }) {
  if (message.role !== "assistant") return null;
  return (
    <div className="message-actions">
      <button onClick={() => onRegenerate(message.id)}>Regenerate</button>
      <button onClick={() => navigator.clipboard.writeText(message.content)}>Copy</button>
    </div>
  );
}
```

"Regenerate" typically means: truncate the message list back to (and including) the
preceding user message, then re-send that same request — the backend doesn't need any
special "regenerate" endpoint, just a normal chat request replaying history.

## Optimistic UI + error recovery

```jsx
const sendMessage = async (text) => {
  const userMsg = { id: crypto.randomUUID(), role: "user", content: text, status: "complete" };
  const assistantMsg = { id: crypto.randomUUID(), role: "assistant", content: "", status: "streaming" };
  setMessages((prev) => [...prev, userMsg, assistantMsg]);

  try {
    await streamChat([...messages, userMsg], /* onToken */ (token) => {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantMsg.id ? { ...m, content: m.content + token } : m
      ));
    });
    setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, status: "complete" } : m));
  } catch (err) {
    setMessages((prev) => prev.map((m) =>
      m.id === assistantMsg.id ? { ...m, status: "error", content: m.content || "Something went wrong." } : m
    ));
  }
};
```

Render `status === "error"` messages with a distinct style (e.g., a retry button)
rather than silently failing or leaving an empty bubble.

## Conversation persistence

```jsx
// Save conversation history to your backend after each complete exchange
useEffect(() => {
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.status === "complete") {
    fetch("/api/conversations/" + conversationId, {
      method: "PATCH",
      body: JSON.stringify({ messages }),
    });
  }
}, [messages]);
```

Persist after each **complete** exchange, not on every token — persisting mid-stream
is wasted write volume for data that's about to change again immediately.

## Practical guidance

1. **Give every message a stable UUID**, generated client-side for optimistic
   messages (`crypto.randomUUID()`), not derived from array position.
2. **Memoize markdown rendering** per-message and gate re-renders on content equality.
3. **Disable auto-scroll once the user scrolls up** — re-enable only when they
   return near the bottom themselves.
4. **Show a distinct "Stop" control during streaming**, not just a disabled Send
   button.
5. **Treat "Regenerate" as a normal chat request** replaying truncated history, not a
   special endpoint.
6. **Persist conversation state after complete exchanges**, not on every streamed
   token.