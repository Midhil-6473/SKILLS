# Structured Outputs in Depth

## The core value proposition

Traditional LLM agent code treats the response as a string you parse yourself —
regex, manual JSON parsing, hoping the model followed your formatting instructions.
Pydantic AI inverts this: **you declare a typed output model, and the framework
guarantees `result.output` conforms to it, or raises/retries** — an LLM response
that doesn't match your schema never silently corrupts downstream data.

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class Invoice(BaseModel):
    vendor: str
    total: float
    line_items: list[str]

agent = Agent("claude-sonnet-4-6", output_type=Invoice)
result = agent.run_sync("Extract invoice details from: ...")
invoice: Invoice = result.output   # guaranteed to be a valid Invoice, or the run raised
```

## Automatic validation retries

If the model's response fails validation against `output_type`, Pydantic AI
**automatically retries**, feeding the validation error back to the model as
context for correction — this happens transparently, without your application
code needing to handle the failure case manually.

```python
# Conceptually, what happens internally on a validation failure:
# 1. Model responds with something that doesn't match the Invoice schema
# 2. Pydantic AI catches the ValidationError
# 3. The error message is sent back to the model: "Your response didn't match
#    the schema: <error details>. Please try again."
# 4. Model retries, informed by the specific validation failure
# 5. Up to `retries` attempts (default budget — see tools_and_dependencies.md)
```

**Cost implication worth knowing:** validation failures triggering retries cost
real tokens. If you're seeing frequent retries in practice, it usually means either
your `output_type` schema is stricter than necessary, or your system prompt isn't
clearly explaining the expected output format/values to the model.

## Don't over-type

```python
# Unnecessary — adds validation-retry risk for zero real benefit
class SimpleAnswer(BaseModel):
    answer: str

agent = Agent("claude-sonnet-4-6", output_type=SimpleAnswer)

# Better — just use output_type=str (the default; can be omitted entirely)
agent = Agent("claude-sonnet-4-6")
result = agent.run_sync("What's the capital of France?")
print(result.output)   # a plain string, no schema overhead
```

**If you just want a string or a simple bool back, don't wrap it in a Pydantic
model.** `output_type=str` (or omitting `output_type` entirely, since string is the
default) is completely fine and avoids unnecessary validation-retry surface area.
Reserve structured `output_type` models for outputs with genuine internal
structure your application code needs to process.

## Unions and discriminated outputs

```python
from typing import Union, Literal
from pydantic import BaseModel

class SuccessResult(BaseModel):
    status: Literal["success"]
    data: dict

class ErrorResult(BaseModel):
    status: Literal["error"]
    message: str

agent = Agent("claude-sonnet-4-6", output_type=Union[SuccessResult, ErrorResult])

result = agent.run_sync("Process this request: ...")
if result.output.status == "success":
    print(result.output.data)
else:
    print(result.output.message)
```

A `Literal` discriminator field (`status` here) lets the model choose between
distinct output shapes, and lets your application code branch on `isinstance` or
the discriminator value with full type-checker support — the standard pattern for
"this could succeed or fail in structurally different ways."

## Output strategies — text path vs. tool path

Pydantic AI can extract structured output two ways, and generally picks
automatically based on the model's capabilities:

- **Text path** — the model's final text response is parsed and validated against
  the schema directly.
- **Tool path** — the schema is presented to the model as a synthetic "final
  answer" tool, and the model "calls" it with the structured arguments — this
  tends to be more reliable for models with strong native tool-calling support.

```python
from pydantic_ai import Agent
from pydantic_ai.output import ToolOutput

agent = Agent(
    "claude-sonnet-4-6",
    output_type=ToolOutput(Invoice, max_retries=2),   # force the tool-based path explicitly
)
```

You rarely need to force this explicitly — the framework's automatic choice is
usually correct — but the override is available for edge cases where you've
observed one path performing more reliably for your specific model/schema
combination.

## Streaming structured output

```python
async with agent.run_stream("Extract the invoice details from...") as result:
    async for partial in result.stream_output():
        print(partial)   # progressively more complete partial Invoice objects
    final: Invoice = await result.get_output()
```

For structured (non-text) outputs, streaming yields progressively-completing
partial objects rather than raw text tokens — useful for a UI that wants to render
a form or structured preview filling in field-by-field as the model generates it
(see this skill collection's `react-ai-architect` skill, `agentic_ui_patterns.md`,
for the "partial JSON" frontend rendering pattern this pairs with).

## Validators on output models — reusing normal Pydantic validation

```python
from pydantic import BaseModel, field_validator

class ExtractedContact(BaseModel):
    email: str
    phone: str

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        digits = "".join(c for c in value if c.isdigit())
        if len(digits) != 10:
            raise ValueError("Phone number must have exactly 10 digits")
        return digits

agent = Agent("claude-sonnet-4-6", output_type=ExtractedContact)
```

**This is a genuine advantage over hand-parsing LLM output**: all of Pydantic's
normal validator machinery (see `validators.md`) applies directly to structured
agent outputs — business-rule enforcement, normalization, and cross-field checks
all work exactly the same as they would on an incoming API request body, with the
same automatic retry-on-failure behavior feeding the error back to the model.

## Practical guidance

1. **Use `output_type=str` (or omit it) unless the output genuinely has internal
   structure** your application needs to process — don't over-type trivial
   responses.
2. **Watch for excessive validation retries** as a signal that your schema is too
   strict or your prompt under-specifies the expected format — both cost real
   tokens.
3. **Use `Literal`-discriminated unions** for outputs that can take structurally
   different shapes depending on outcome (success/error, different classification
   branches).
4. **Attach normal Pydantic validators to output models** — business-rule
   enforcement on LLM output gets the same automatic retry-and-correct behavior as
   any other validation failure.
5. **Reach for streaming structured output** when a frontend needs to render a
   structured result progressively rather than waiting for full completion.