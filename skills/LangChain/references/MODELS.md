# Models — Reference

The model is the reasoning engine of an agent: it decides which tools to call,
interprets results, and produces the final answer. LangChain gives every
provider the same standard interface so you can swap models without rewriting
application logic.

## Initializing a model

Two equivalent ways — prefer `init_chat_model` for quick starts, the provider
class when you need full control or static typing on params.

```python
# Way 1: init_chat_model (recommended default)
from langchain.chat_models import init_chat_model
model = init_chat_model("claude-sonnet-4-6")          # provider inferred
model = init_chat_model("anthropic:claude-sonnet-4-6") # explicit provider

# Way 2: Provider class directly
from langchain_anthropic import ChatAnthropic
model = ChatAnthropic(model="claude-sonnet-4-6", temperature=0.1, max_tokens=1000, timeout=30)
```

| Provider | Install | Example model string |
|---|---|---|
| OpenAI | `pip install -U "langchain[openai]"` | `"gpt-5.5"` / `"openai:gpt-5.5"` |
| Anthropic | `pip install -U "langchain[anthropic]"` | `"claude-sonnet-4-6"` |
| Azure OpenAI | `pip install -U "langchain[openai]"` | `"azure_openai:gpt-5.5"` |
| Google Gemini | `pip install -U "langchain[google-genai]"` | `"google_genai:gemini-3.5-flash"` |
| AWS Bedrock | `pip install -U "langchain[aws]"` | model ARN + `model_provider="bedrock_converse"` |
| HuggingFace | `pip install -U "langchain[huggingface]"` | repo id + `model_provider="huggingface"` |
| OpenRouter | `pip install -U langchain-openrouter` | `"auto"` via `ChatOpenRouter` |
| Local (Ollama, etc.) | provider-specific | great for privacy/cost-sensitive local inference |

New model names work immediately with no LangChain update needed — provider
packages just pass the string straight to the provider API.

## Common parameters

| Param | Meaning |
|---|---|
| `model` | Required. Model name, optionally `"provider:model"`. |
| `api_key` | Usually set via env var instead. |
| `temperature` | Randomness; higher = more creative, lower = more deterministic. |
| `max_tokens` | Caps response length. |
| `timeout` | Seconds to wait before giving up. |
| `max_retries` | Default **6**. Network errors / 429 / 5xx are auto-retried with exponential backoff + jitter; 401/404 are not. Bump to 10–15 for long-running agents on flaky networks. |

```python
model = init_chat_model(
    "claude-sonnet-4-6",
    temperature=0.7,
    timeout=30,
    max_tokens=1000,
    max_retries=6,
)
```

## Invocation methods

```python
response = model.invoke("Why do parrots talk?")            # single full response (AIMessage)

for chunk in model.stream("Why do parrots talk?"):           # progressive AIMessageChunks
    print(chunk.text, end="|", flush=True)

responses = model.batch([q1, q2, q3])                         # parallel client-side batch
for r in model.batch_as_completed([q1, q2, q3]):              # results as they finish (out of order)
    print(r)
```

Stream chunks are summable into a full message:
```python
full = None
for chunk in model.stream("What color is the sky?"):
    full = chunk if full is None else full + chunk
print(full.content_blocks)
```

For semantic event streaming (start/token/end events), use `model.astream_events(...)`.

Conversation history as input — dict, message-object, or mixed:
```python
from langchain.messages import HumanMessage, AIMessage, SystemMessage

conversation = [
    SystemMessage("You are a helpful assistant that translates English to French."),
    HumanMessage("Translate: I love programming."),
    AIMessage("J'adore la programmation."),
    HumanMessage("Translate: I love building applications."),
]
response = model.invoke(conversation)
```

## Tool calling (standalone, outside an agent)

```python
from langchain.tools import tool

@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return f"It's sunny in {location}."

model_with_tools = model.bind_tools([get_weather])
response = model_with_tools.invoke("What's the weather in Boston?")
for tc in response.tool_calls:
    print(tc["name"], tc["args"])
```

Outside of an agent, **you** must execute the tool and feed the result back:
```python
messages = [{"role": "user", "content": "What's the weather in Boston?"}]
ai_msg = model_with_tools.invoke(messages)
messages.append(ai_msg)
for tool_call in ai_msg.tool_calls:
    messages.append(get_weather.invoke(tool_call))   # ToolMessage appended
final = model_with_tools.invoke(messages)
```
Inside `create_agent`, this loop is handled for you automatically — see `agents.md`.

Other tool-calling controls:
```python
model.bind_tools([tool_1], tool_choice="any")       # force any tool
model.bind_tools([tool_1], tool_choice="tool_1")    # force specific tool
model.bind_tools([get_weather], parallel_tool_calls=False)  # disable parallel calls
```

## Structured output

```python
from pydantic import BaseModel, Field

class Movie(BaseModel):
    title: str = Field(description="The title of the movie")
    year: int
    director: str
    rating: float

model_with_structure = model.with_structured_output(Movie)
result = model_with_structure.invoke("Provide details about Inception")
# Movie(title='Inception', year=2010, director='Christopher Nolan', rating=8.8)
```

Also supports `TypedDict` and raw JSON Schema as the schema type. Methods:
`'json_schema'` (provider-native), `'function_calling'` (forces a tool call),
`'json_mode'` (legacy precursor — schema must be described in the prompt).
Use `include_raw=True` to get both the parsed object and the raw `AIMessage`
(useful for token-usage metadata).

## Multimodal

Pass content blocks (image/audio/video) per the messages guide; models that
support multimodal output return content blocks of the corresponding type:
```python
response = model.invoke("Create a picture of a cat")
print(response.content_blocks)
# [{"type": "text", ...}, {"type": "image", "base64": "...", "mime_type": "image/jpeg"}]
```

## Reasoning

```python
response = model.invoke("Why do parrots have colorful feathers?")
reasoning_steps = [b for b in response.content_blocks if b["type"] == "reasoning"]
```
Some providers let you set reasoning effort (`'low'`/`'high'` or a token budget)
or disable it — check the specific provider integration page.

## Prompt caching

- **Implicit** (automatic cost savings): OpenAI, Gemini.
- **Explicit** (you mark cache points): `ChatOpenAI` (`prompt_cache_key`),
  Anthropic's `AnthropicPromptCachingMiddleware`, Gemini, AWS Bedrock.

Example using a `SystemMessage` with explicit Anthropic cache control:
```python
from langchain.messages import SystemMessage

system = SystemMessage(content=[
    {"type": "text", "text": "You are an AI assistant analyzing literary works."},
    {"type": "text", "text": "<huge static reference text>", "cache_control": {"type": "ephemeral"}},
])
```
Caching is typically only engaged above a minimum input-token threshold.

## Server-side tool use

Some providers run tool loops server-side (e.g., built-in web search):
```python
model_with_tools = model.bind_tools([{"type": "web_search"}])
response = model_with_tools.invoke("What was a positive news story from today?")
print(response.content_blocks)  # server_tool_call / server_tool_result / text blocks
```
No client-side `ToolMessage` round trip needed — it's a single conversational turn.

## Rate limiting

```python
from langchain_core.rate_limiters import InMemoryRateLimiter

rate_limiter = InMemoryRateLimiter(
    requests_per_second=0.1, check_every_n_seconds=0.1, max_bucket_size=10,
)
model = init_chat_model("gpt-5.5", model_provider="openai", rate_limiter=rate_limiter)
```
Note: this limits request *count*, not request *size*.

## Custom base URL / proxy (OpenAI-compatible endpoints)

```python
model = init_chat_model(model="MODEL_NAME", model_provider="openai",
                         base_url="BASE_URL", api_key="YOUR_API_KEY")
```
For OpenRouter or LiteLLM, prefer their dedicated integrations
(`langchain-openrouter`, `langchain-litellm`) instead of forcing them through
the generic OpenAI base_url path.

## Token usage tracking

```python
from langchain_core.callbacks import get_usage_metadata_callback

with get_usage_metadata_callback() as cb:
    model_1.invoke("Hello")
    model_2.invoke("Hello")
    print(cb.usage_metadata)   # per-model dict of input/output/total tokens
```

## Configurable models (swap model at call time, not creation time)

```python
configurable_model = init_chat_model(temperature=0)
configurable_model.invoke("what's your name", config={"configurable": {"model": "gpt-5-nano"}})
configurable_model.invoke("what's your name", config={"configurable": {"model": "claude-sonnet-4-6"}})
```
You can also `bind_tools`/`with_structured_output` declaratively on a
configurable model before choosing the concrete model at invocation time.

## Model profiles (langchain>=1.1, beta)

```python
model.profile
# {"max_input_tokens": 400000, "image_inputs": True, "reasoning_output": True, "tool_calling": True, ...}
```
Used internally by things like `SummarizationMiddleware` (to know when to
trigger based on context-window fraction) and `create_agent`'s structured-output
strategy inference. You can override with `init_chat_model("...", profile={...})`.

## Dynamic model selection (preview — full pattern lives in agents.md / middleware.md)

```python
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse

basic_model = init_chat_model("gpt-5.4-mini")
advanced_model = init_chat_model("gpt-5.5")

@wrap_model_call
def dynamic_model_selection(request: ModelRequest, handler) -> ModelResponse:
    model = advanced_model if len(request.state["messages"]) > 10 else basic_model
    return handler(request.override(model=model))

agent = create_agent(model=basic_model, tools=tools, middleware=[dynamic_model_selection])
```
Caveat: pre-bound models (already had `bind_tools` called) aren't supported
together with structured output — keep models passed to middleware un-bound.