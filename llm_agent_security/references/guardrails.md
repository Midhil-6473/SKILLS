# Runtime Guardrails — NeMo Guardrails, Guardrails AI, LLM Guard, and DIY

## What a guardrail layer actually does

A guardrail layer sits between the raw LLM call and the rest of your
application, scoring every prompt and every response, returning an
**allow / block / rewrite** decision, and (ideally) emitting a trace that an
offline regression suite can replay later. Guardrails are a **runtime defense**
— they reduce damage from attacks reaching production; they are not a substitute
for red-teaming (see `red_teaming.md`), which finds weaknesses *before*
deployment. The field's consensus for 2026: you need both.

## The three major open-source guardrail tools compared

| Tool | Core focus | Style | Best for |
|---|---|---|---|
| **NeMo Guardrails** (NVIDIA) | Programmable dialogue rails — topic restriction, fact-check rails, jailbreak defense, tool-call rails | Rules written in **Colang**, a purpose-built DSL for conversational flow | Highly scripted dialogue products (regulated customer support, compliance-sensitive chat) where you want fine-grained programmatic control over conversation flow |
| **Guardrails AI** | Validating and structuring LLM inputs/outputs — wraps any LLM call in a validate-and-reask loop | Python library, schema/validator-based | Any application where the LLM must return structured data (forms, API payloads, reports) — closer to a "Pydantic for LLM output" than a security tool specifically |
| **LLM Guard** (Protect AI) | Sanitizing both prompts and responses — PII anonymization, prompt-injection detection, secrets detection, toxicity | Runs as middleware, chains multiple scanners together | Comprehensive input/output scanning as a single integration point; the most commonly cited "default choice" for general-purpose runtime protection |

**Most production AI agents combine two or three of these** — this is explicitly
not a one-or-nothing choice. A common combination: LLM Guard or NeMo Guardrails
for input/output scanning, Guardrails AI when structured output validation is
also needed, with a specialized injection-detection layer (Rebuff, or a
dedicated classifier) added specifically if prompt injection is a known elevated
threat for that use case (user-submitted content, RAG over untrusted documents).

## LLM Guard — practical usage

```bash
pip install llm-guard
```

```python
from llm_guard import scan_prompt, scan_output
from llm_guard.input_scanners import PromptInjection, Anonymize
from llm_guard.output_scanners import Toxicity, Secrets, Sensitive

# Scan the incoming prompt before it reaches the model
sanitized_prompt, results_valid, results_score = scan_prompt(
    [PromptInjection(), Anonymize()],
    user_input,
)
if not all(results_valid.values()):
    raise SecurityException("Input failed security scan")

# Scan the model's output before it reaches the user or gets acted on
sanitized_output, results_valid, results_score = scan_output(
    sanitized_prompt, model_output,
    [Toxicity(), Secrets(), Sensitive()],
)
```

Each scanner returns a validity boolean and a risk score — the calling code
decides the allow/block/rewrite policy based on both, giving you room to tune
thresholds per use case rather than a hardcoded binary pass/fail.

## NeMo Guardrails — practical usage

```bash
pip install nemoguardrails
```

```python
from nemoguardrails import LLMRails, RailsConfig

config = RailsConfig.from_path("./config")   # Colang rail definitions live here
rails = LLMRails(config)

response = rails.generate(messages=[
    {"role": "user", "content": user_input}
])
```

```colang
# config/rails.co — a simplified example of a Colang topic-restriction rail
define user ask about competitors
  "What do you think of [competitor]?"
  "How does this compare to [competitor product]?"

define bot refuse to discuss competitors
  "I'm not able to discuss competitor products. I'd be happy to tell you about our own offerings."

define flow
  user ask about competitors
  bot refuse to discuss competitors
```

Colang's DSL is the real learning-curve cost of NeMo Guardrails — but it buys
genuinely fine-grained, auditable control over conversational flow that pure
prompt-based restriction can't reliably guarantee. **Latency varies by rail
type**: pattern-based rails run sub-100ms; rails that call a separate LLM
(fact-checking, moderation classification) add a full additional LLM-call's
worth of latency — factor this into any real-time chat UX budget.

## Guardrails AI — structured output validation

```bash
pip install guardrails-ai
```

```python
from guardrails import Guard
from pydantic import BaseModel

class MedicalAdvice(BaseModel):
    recommendation: str
    disclaimer: str
    urgency_level: str   # e.g. "low" | "medium" | "high" | "emergency"

guard = Guard.from_pydantic(output_class=MedicalAdvice)

result = guard(
    llm_api=your_llm_call_function,
    prompt="Provide guidance for: {user_symptoms}",
)
# Guardrails AI automatically re-asks the model if the output doesn't validate
# against the schema, similar in spirit to Pydantic AI's automatic retry (see
# this collection's pydantic-architect skill, structured_outputs.md)
```

Guardrails AI's "Hub" also ships pre-built validators for common security-adjacent
checks (detecting PII, profanity, competitor mentions, and more) beyond pure
schema validation — worth browsing before writing a custom validator from scratch.

## Building your own lightweight filter (when a full framework is overkill)

```python
import re
from dataclasses import dataclass

@dataclass
class ScanResult:
    is_safe: bool
    reason: str | None = None

INJECTION_PATTERNS = [
    r"ignore (all )?(previous|above|prior) instructions",
    r"you are now",
    r"disregard (your|the) (system prompt|instructions)",
    r"reveal (your|the) (system prompt|instructions)",
]

def basic_injection_scan(text: str) -> ScanResult:
    lowered = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, lowered):
            return ScanResult(is_safe=False, reason=f"Matched pattern: {pattern}")
    return ScanResult(is_safe=True)
```

**This kind of regex-based filter is a genuinely weak defense on its own** —
trivially evaded by paraphrasing, encoding, or any of the obfuscation techniques
in `prompt_injection.md` and `jailbreaks.md`. Treat this as a cheap, fast
first-pass filter (catches the laziest attacks, adds negligible latency), never
as your only or primary defense — a classifier-based scanner (LLM Guard's
`PromptInjection()`, or a dedicated fine-tuned model like Protect AI's
DeBERTa-v3 prompt-injection classifier) is meaningfully more robust and should
be the actual primary layer for anything beyond a low-stakes internal tool.

## Where to place guardrails in the request flow

```
User input → [Input guardrail: injection detection, PII scan] → LLM →
  [Output guardrail: toxicity, secrets, structured validation] → Action/Response
```

For **agentic** systems specifically, add a third checkpoint:

```
... → LLM decides to call a tool → [Tool-call guardrail: is this tool call within
  policy? does it match an approved pattern? does it need human approval?] →
  Tool executes → [Tool-result guardrail: scan the result before it re-enters
  context, since tool results are exactly where indirect injection often enters] → ...
```

**The tool-result checkpoint is the one teams most often forget** — a tool's
output (a web page fetched, a database row returned, a file's contents) is
untrusted content re-entering the model's context, and deserves the same
scanning discipline as the original user input.

## Practical guidance

1. **Pick guardrail tooling based on your primary need**: LLM Guard for
   general-purpose input/output scanning, NeMo Guardrails for scripted
   conversational flow control, Guardrails AI for structured output validation —
   most real systems combine more than one.
2. **Never rely on regex/keyword filtering alone** — use it only as a cheap
   first-pass layer in front of a classifier-based scanner.
3. **Add a tool-call and tool-result guardrail checkpoint for agents**, not just
   input/output on the user-facing message — this is the checkpoint most often
   missing in real deployments.
4. **Track false-positive rate alongside bypass rate** once in production —
   overly aggressive guardrails create real usability problems (a medical AI
   justifiably needs stricter guardrails than an internal coding assistant; tune
   thresholds to the actual risk tolerance of the use case, not a one-size-fits-all
   default).
5. **Guardrails are Layer 2 of a four-layer defense** (see `SKILL.md`) — they
   reduce production risk but don't replace least-privilege architecture
   (Layer 3) or pre-deployment red-teaming (Layer 4).