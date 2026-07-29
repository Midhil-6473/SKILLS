# Output Handling — PII/Secret Leakage, Downstream Injection, Untrusted Output

## The core principle: LLM output is untrusted input to whatever consumes it next

**Improper output handling** (OWASP LLM05) is the mirror image of the input-side
risks covered elsewhere in this skill — teams that carefully scrutinize
*incoming* content often forget that an LLM's *output* deserves exactly the same
treatment before it's executed, rendered, or stored. If the output reaches a
database, a shell, a browser, or another system, apply the same sanitization
you'd apply to any other untrusted input reaching that same destination.

## Downstream injection via LLM output

```python
# Dangerous: LLM-generated SQL executed directly
def query_from_natural_language(user_question: str) -> list:
    sql = llm_generate_sql(user_question)   # the model writes a SQL query
    return db.execute(sql)                    # ...and it runs UNVALIDATED

# An attacker's natural-language input could manipulate the model into generating:
#   "'; DROP TABLE users; --"
# or a query that exfiltrates data far beyond what the user's own question needed
```

```python
# Safer: constrain what the model can generate, and validate before execution
ALLOWED_TABLES = {"orders", "products"}
ALLOWED_OPERATIONS = {"SELECT"}

def query_from_natural_language(user_question: str) -> list:
    sql = llm_generate_sql(user_question)
    parsed = sqlparse.parse(sql)[0]
    if parsed.get_type() not in ALLOWED_OPERATIONS:
        raise SecurityException("Only SELECT queries are permitted")
    tables_referenced = extract_table_names(parsed)
    if not tables_referenced.issubset(ALLOWED_TABLES):
        raise SecurityException("Query references disallowed tables")
    # Even better: use a read-only DB role/connection (see least_privilege_architecture.md)
    # as a second, independent layer beneath this validation
    return db.execute(sql)
```

**The same pattern applies to any generation target**: LLM-generated shell
commands (validate against an allowlist, or better, don't generate raw shell
commands at all — expose specific narrow tools instead, per
`least_privilege_architecture.md`), LLM-generated HTML/JS rendered in a browser
(sanitize for XSS exactly as you would any user-generated HTML), and
LLM-generated file paths (validate against path traversal, exactly as in the
`delete_file` example in `agentic_risks.md`).

## PII and secrets leakage in output

```python
from llm_guard.output_scanners import Secrets, Anonymize

sanitized_output, is_valid, risk_score = scan_output(
    prompt, model_output,
    [Secrets(), Anonymize()],   # detects API keys, credentials, and common PII patterns
)
if not is_valid["Secrets"]:
    # The model's response contains something that looks like a credential —
    # this can happen if training data, retrieved context, or conversation
    # history contained a real secret the model then reproduced
    log_security_incident("potential secret leaked in model output")
    return "I'm not able to share that information."
```

Secrets can end up in LLM output through several paths worth distinguishing:
training data memorization (rare with modern frontier models but not
impossible), **retrieved RAG context that itself contained a secret** (a far
more common real-world path — e.g., an internal document accidentally
containing an API key, later retrieved and echoed back), or conversation
history from earlier in a session. **Scan output regardless of which path is
suspected** — the mitigation (catch it before it reaches the user) is the same
either way.

## PII detection and redaction

```python
from llm_guard.output_scanners import Anonymize
from llm_guard.vault import Vault

vault = Vault()   # stores the mapping from redacted placeholder back to original, if needed later
scanner = Anonymize(vault, entity_types=["PERSON", "EMAIL", "PHONE_NUMBER", "CREDIT_CARD"])
sanitized_output, is_valid, score = scanner.scan(prompt, model_output)
# sanitized_output has PII replaced with placeholders like [REDACTED_EMAIL]
```

For applications processing genuinely sensitive data (healthcare, financial,
legal), **PII scanning on output should be a hard requirement, not an optional
enhancement** — this is exactly the kind of check most naive chatbot
implementations skip, since it doesn't affect the "happy path" demo experience
at all, only real-world edge cases with real consequences.

## System prompt and internal-reasoning leakage

```python
# Some models/APIs support hiding intermediate reasoning from the final output —
# use this where available rather than relying on prompt instructions alone
response = client.messages.create(
    model="claude-sonnet-4-6",
    # extended thinking / reasoning content, where supported, is a separate
    # content block from the final answer — don't surface it to end users
    # unless you specifically intend to and have reviewed what it might reveal
    messages=[...],
)
final_answer_only = extract_text_blocks(response)   # deliberately exclude reasoning blocks
```

Reasoning/"thinking" content can reveal more about internal logic, retrieved
context, or system instructions than the polished final answer would — treat it
as a distinct, higher-sensitivity output stream requiring its own handling
decision, not something to expose to end users by default just because it's
technically available in the API response.

## Content moderation on output

```python
from llm_guard.output_scanners import Toxicity, Bias, NoRefusal

sanitized, is_valid, score = scan_output(
    prompt, model_output,
    [Toxicity(threshold=0.7), Bias(), NoRefusal()],
)
```

`NoRefusal` specifically detects when a model's response is an unexpected
refusal/non-answer — useful less as a security control and more as a **quality
signal**: an unexpected spike in refusal rate on legitimate traffic can indicate
an overly aggressive upstream guardrail causing false positives (see
`guardrails.md`'s note on balancing false-positive rate against bypass rate).

## Practical guidance

1. **Apply the exact same validation discipline to LLM output as to any other
   untrusted input**, based on where that output is headed next (a database, a
   shell, a browser, a file system) — this symmetry is the single idea most
   worth internalizing from this file.
2. **Never execute LLM-generated code, SQL, or shell commands without
   allowlist-based validation**, and prefer exposing narrow specific tools over
   generating and executing raw commands at all.
3. **Scan output for secrets and PII regardless of the suspected source** — the
   mitigation is the same whether it came from training data, RAG context, or
   conversation history.
4. **Treat reasoning/"thinking" output as a distinct, higher-sensitivity
   stream** — don't surface it to end users by default without a deliberate
   decision to do so.
5. **Track refusal rate as a quality signal**, not just a security metric — an
   unexpected spike often indicates guardrail false positives rather than a
   genuine new threat.