# State Management & Architecture for AI Apps

## When Context/useState is enough vs. when to reach for a library

| App shape | Recommended approach |
|---|---|
| Single chat interface, one conversation at a time | `useState`/`useReducer` in the top-level component, passed via props or one Context |
| Multiple conversations, conversation switching, shared user/auth state | Context for global concerns (auth, theme) + a lightweight store (Zustand) for conversation state |
| Complex agent dashboards, multi-agent state, job monitoring across many concurrent jobs | Zustand or Redux Toolkit — the state shape and update patterns get complex enough to benefit from a dedicated store with selectors |
| Server state (conversation history persisted server-side, job statuses, model lists) | **TanStack Query (React Query)**, regardless of app complexity — this is a fundamentally different concern from client UI state |

**The single most important distinction:** separate **server state** (data that
lives on your backend and can go stale — conversation history, job status, available
models) from **client state** (UI-only concerns — is the sidebar open, what's typed
in the input box). Conflating these into one `useState`/Redux blob is the most common
architecture mistake in AI app frontends.

## TanStack Query for server state

```bash
npm install @tanstack/react-query
```

```jsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetch("/api/conversations").then((r) => r.json()),
  });
}

function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message) => fetch("/api/chat", { method: "POST", body: JSON.stringify(message) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
}
```

TanStack Query handles caching, background refetching, and loading/error states for
you — genuinely valuable for conversation lists, model catalogs, job status lists,
and anything else that's "data fetched from the backend," as opposed to the
token-by-token streaming case (which needs manual state management — see
`streaming_llm_ui.md` — since streaming doesn't fit a request/response query model).

## Zustand for client-side app state

```bash
npm install zustand
```

```jsx
import { create } from "zustand";

const useChatStore = create((set) => ({
  activeConversationId: null,
  sidebarOpen: true,
  selectedModel: "claude-sonnet-4-6",
  setActiveConversation: (id) => set({ activeConversationId: id }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setModel: (model) => set({ selectedModel: model }),
}));

function ModelSelector() {
  const { selectedModel, setModel } = useChatStore();
  return (
    <select value={selectedModel} onChange={(e) => setModel(e.target.value)}>
      <option value="claude-sonnet-4-6">Claude Sonnet</option>
      <option value="gpt-5.5">GPT-5.5</option>
    </select>
  );
}
```

Zustand's appeal for AI apps specifically: minimal boilerplate for state that many
components need (active conversation, selected model, UI panel visibility) without
Redux's ceremony, and no Context re-render cascades.

## API layer design — a dedicated client module

```jsx
// api/client.js — single source of truth for backend communication
const API_BASE = import.meta.env.VITE_API_URL;

export async function sendChatMessage(messages, { signal } = {}) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return response.json();
}

export async function* streamChatMessage(messages, { signal } = {}) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST", body: JSON.stringify({ messages }), signal,
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // ... parsing logic (see streaming_llm_ui.md), yielding tokens
}

class ApiError extends Error {
  constructor(status, body) { super(`API error ${status}`); this.status = status; this.body = body; }
}
```

Centralizing all backend calls in one module (rather than scattering `fetch` calls
through components) makes it trivial to add cross-cutting concerns later —
authentication headers, retry logic, error tracking — in one place.

## Folder structure for a mid-size AI app

```
src/
├── api/
│   ├── client.js          # fetch wrappers, streaming helpers
│   └── queries.js         # TanStack Query hooks
├── components/
│   ├── chat/
│   │   ├── MessageList.jsx
│   │   ├── ChatInput.jsx
│   │   └── ToolCallCard.jsx
│   ├── agents/
│   └── dashboard/
├── hooks/
│   ├── useChatStream.js
│   └── useJobProgress.js
├── store/
│   └── chatStore.js        # Zustand store
├── types/
│   └── chat.ts              # Message, ToolCall, AgentEvent types
└── App.jsx
```

## Handling authentication for AI endpoints

```jsx
// api/client.js
async function authenticatedFetch(url, options = {}) {
  const token = getAuthToken();  // from your auth provider (Clerk, Auth0, custom JWT, etc.)
  return fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
}
```

Every AI endpoint — inference, chat, agent runs — should be authenticated the same
way as any other API endpoint in your app; there's nothing AI-specific about auth
itself, but it's worth stating explicitly since it's easy to prototype an "AI demo"
endpoint without auth and forget to add it before shipping.

## Error boundaries for AI-specific failure modes

```jsx
class AIErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) { return { hasError: true, error }; }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ai-error-fallback">
          <p>The AI assistant encountered an error. This might be a temporary issue with the model provider.</p>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

AI-specific failure modes worth handling distinctly from generic app errors: model
provider outages/rate limits, content filtering rejections, context length exceeded,
and streaming connection drops mid-response — each benefits from a tailored message
rather than a generic "Something went wrong."

## Practical guidance

1. **Separate server state (TanStack Query) from client UI state (Zustand or
   Context)** — this is the architectural decision that matters most as an AI app
   grows.
2. **Centralize all backend communication in an `api/` module**, including streaming
   helpers — never scatter raw `fetch` calls through components.
3. **Handle streaming state manually** (custom hooks + `useReducer`) since it doesn't
   fit TanStack Query's request/response model — the two approaches coexist,
   each for the concern it fits.
4. **Add auth to AI endpoints from day one** — it's easy to prototype without it and
   forget before shipping.
5. **Build tailored error handling for AI-specific failures** (rate limits, content
   filtering, context length, stream drops) rather than one generic error boundary.