# Agentic UI Patterns — Tool Calls, Reasoning Traces, Human-in-the-Loop

## Why agentic UIs need more than a text stream

A plain chatbot's UI contract is simple: tokens arrive, append them to a bubble. An
**agent** — something that reasons across multiple steps, calls tools, and possibly
waits for human approval — needs a UI that can represent:

- Which tool is being called, with what arguments
- The tool's result, once it returns
- Intermediate "thinking" or planning steps (if your agent surfaces them)
- Multi-agent handoffs (which sub-agent is currently active)
- Points where the agent is paused, waiting for human approval

Treat your backend's event stream as **structured, typed events** (not flat text) so
the frontend can render all of this — see `streaming_llm_ui.md` for the SSE event
schema this builds on.

## Data model for an agentic conversation

```ts
type AgentEvent =
  | { type: "token"; text: string }
  | { type: "tool_call_start"; id: string; name: string; args: Record<string, any> }
  | { type: "tool_call_result"; id: string; result: any; isError?: boolean }
  | { type: "agent_handoff"; from: string; to: string }
  | { type: "step_start"; label: string }
  | { type: "human_input_required"; prompt: string; requestId: string }
  | { type: "done" };
```

## Rendering a tool call as it happens

```jsx
function ToolCallCard({ toolCall }) {
  const { name, args, status, result } = toolCall;
  return (
    <div className={`tool-call tool-call--${status}`}>
      <div className="tool-call__header">
        <ToolIcon name={name} />
        <span>{formatToolName(name)}</span>
        {status === "running" && <Spinner size="small" />}
        {status === "complete" && <CheckIcon />}
        {status === "error" && <ErrorIcon />}
      </div>
      <details>
        <summary>Arguments</summary>
        <pre>{JSON.stringify(args, null, 2)}</pre>
      </details>
      {result && (
        <details>
          <summary>Result</summary>
          <pre>{typeof result === "string" ? result : JSON.stringify(result, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
```

Collapse arguments/results behind `<details>` by default — showing raw JSON
prominently overwhelms the UI; users mostly want to know *that* a tool ran and
*whether it succeeded*, drilling into details only when debugging.

## Reducer-based state for a full agent run

```jsx
function agentReducer(state, event) {
  switch (event.type) {
    case "token":
      return { ...state, currentText: state.currentText + event.text };
    case "tool_call_start":
      return {
        ...state,
        toolCalls: [...state.toolCalls, { id: event.id, name: event.name, args: event.args, status: "running" }],
      };
    case "tool_call_result":
      return {
        ...state,
        toolCalls: state.toolCalls.map((tc) =>
          tc.id === event.id ? { ...tc, status: event.isError ? "error" : "complete", result: event.result } : tc
        ),
      };
    case "agent_handoff":
      return { ...state, activeAgent: event.to, handoffHistory: [...state.handoffHistory, event] };
    case "human_input_required":
      return { ...state, pendingApproval: { prompt: event.prompt, requestId: event.requestId } };
    case "done":
      return { ...state, status: "complete" };
    default:
      return state;
  }
}

const [agentState, dispatch] = useReducer(agentReducer, {
  currentText: "", toolCalls: [], activeAgent: null, handoffHistory: [],
  pendingApproval: null, status: "running",
});
```

Consuming the SSE stream and dispatching each named event into this reducer keeps
rendering logic declarative — a component reads `agentState.toolCalls` and
`agentState.pendingApproval` without needing to know anything about the transport.

## Human-in-the-loop approval UI

```jsx
function ApprovalPrompt({ pendingApproval, onApprove, onReject }) {
  if (!pendingApproval) return null;
  return (
    <div className="approval-prompt">
      <p>{pendingApproval.prompt}</p>
      <button onClick={() => onApprove(pendingApproval.requestId)}>Approve</button>
      <button onClick={() => onReject(pendingApproval.requestId)}>Reject</button>
    </div>
  );
}
```

```python
# FastAPI backend: pause the agent loop, wait for the approval response
@app.post("/api/agent/approve/{request_id}")
async def approve_action(request_id: str, approved: bool):
    await resume_agent_run(request_id, approved=approved)
    return {"status": "resumed"}
```

The backend agent loop (LangChain/LangGraph or custom) must actually **pause and
persist its state** at the approval point — this typically means using your agent
framework's native interrupt/checkpoint mechanism (e.g., LangGraph's
`interrupt_on`/checkpointer) rather than trying to hold an open HTTP connection
indefinitely while waiting for a human who might take minutes or hours to respond.

## Multi-agent handoff visualization

```jsx
function AgentHandoffTrail({ handoffHistory, activeAgent }) {
  return (
    <div className="agent-trail">
      {handoffHistory.map((h, i) => (
        <span key={i}>{h.from} → {h.to}</span>
      ))}
      <span className="agent-trail__active">Currently: {activeAgent}</span>
    </div>
  );
}
```

For genuinely complex multi-agent systems (a supervisor + several specialists), a
small breadcrumb trail or timeline showing which agent is active — and a brief log of
handoffs — gives users useful transparency into "who" is working on their request
without needing full observability tooling.

## Progress / step indicators for long-running agent tasks

```jsx
function AgentProgress({ steps, currentStepIndex }) {
  return (
    <ol className="agent-progress">
      {steps.map((step, i) => (
        <li key={i} className={i < currentStepIndex ? "done" : i === currentStepIndex ? "active" : "pending"}>
          {step.label}
        </li>
      ))}
    </ol>
  );
}
```

For agents with a somewhat predictable multi-step shape (e.g., "Analyze → Search →
Synthesize → Draft"), an explicit step indicator sets expectations far better than an
undifferentiated spinner — especially for tasks taking 10+ seconds.

## Rendering partial/streaming JSON (structured output mid-stream)

When an agent streams a structured object (e.g., a form being filled field-by-field),
naive `JSON.parse` fails on incomplete JSON. Options:

- Use a "partial JSON" parser (e.g., `partial-json` npm package) that tolerates
  truncated JSON and returns the best-effort parse so far.
- Simpler: have the backend emit one complete, valid JSON object per field/step as a
  discrete event, rather than streaming a single JSON blob token-by-token.

```jsx
import { parse as parsePartialJson } from "partial-json";

function StreamingFormPreview({ partialJsonText }) {
  const parsed = useMemo(() => {
    try { return parsePartialJson(partialJsonText); } catch { return {}; }
  }, [partialJsonText]);

  return <FormPreview data={parsed} />;
}
```

## Practical guidance

1. **Design your backend's event schema before writing any frontend code** — decide
   on `token`/`tool_call_start`/`tool_call_result`/`human_input_required`/`done` (or
   your equivalents) up front, since retrofitting structure onto a flat text stream is
   painful.
2. **Use `useReducer`, not scattered `useState`**, once you're tracking tokens + tool
   calls + handoffs + approval state together — this combination gets unwieldy fast
   with individual state variables.
3. **Collapse tool call arguments/results by default** — show status prominently,
   details on demand.
4. **Implement human-in-the-loop via your agent framework's native
   interrupt/checkpoint mechanism**, not by holding an HTTP connection open — agents
   waiting on humans can be paused for arbitrarily long periods.
5. **Give multi-agent systems a visible handoff trail** — users benefit from knowing
   "who" is handling their request, even in outline form.