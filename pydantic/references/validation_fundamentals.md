# Pydantic Validation Fundamentals — BaseModel, Field, Serialization

## Defining a model

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class User(BaseModel):
    id: int
    name: str
    email: str
    age: int
    is_active: bool = True          # default value
    tags: list[str] = []            # default empty list — see default_factory note below
    created_at: Optional[datetime] = None
```

A model is a class inheriting from `BaseModel`, with fields declared as annotated
class attributes — syntactically similar to a dataclass, but with real validation
and coercion behavior layered on top.

```python
user = User(id="1", name="Alice", email="alice@example.com", age=30)
print(user.id)   # 1 — an int, coerced from the string "1"
```

## Coercion — Pydantic's "smart" mode

By default, Pydantic accepts sensible conversions (`"123"` → `123`, `"true"` →
`True`) but rejects nonsense (`"not-a-number"` → `int` fails loudly with a
`ValidationError`). This coercion behavior is genuinely useful at API/config
boundaries where incoming data is often stringly-typed (query params, env vars,
form data) but should still land as proper Python types.

```python
from pydantic import BaseModel, ValidationError

class Product(BaseModel):
    price: float

try:
    Product(price="not-a-number")
except ValidationError as e:
    print(e)
    # 1 validation error for Product
    # price
    #   Input should be a valid number, unable to parse string as a number
```

## `Field()` — constraints, defaults, and metadata

```python
from pydantic import BaseModel, Field

class Product(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(gt=0, description="Price in USD")
    quantity: int = Field(ge=0, default=0)
    tags: list[str] = Field(default_factory=list)   # correct way to default a mutable value
```

**Always use `default_factory` for mutable defaults** (lists, dicts) — the same
rule as Python dataclasses. `Field(default=[])` would share a single list instance
across every model instance that doesn't explicitly pass `tags`, a classic Python
mutable-default-argument bug.

### Common `Field` constraints

| Constraint | Applies to | Meaning |
|---|---|---|
| `gt`, `ge`, `lt`, `le` | numbers | Greater/less than (or equal) |
| `min_length`, `max_length` | str, list, etc. | Length bounds |
| `pattern` | str | Regex the value must match |
| `default` / `default_factory` | any | Default value / factory function |
| `alias` | any | Alternate name for input/output (e.g., matching a `camelCase` API) |
| `description` | any | Shows up in generated JSON Schema / OpenAPI docs |
| `exclude` | any | Excludes the field from `model_dump()`/serialization output |

## Built-in special types — don't reinvent common validation

```python
from pydantic import BaseModel, EmailStr, HttpUrl, PositiveInt, SecretStr

class Signup(BaseModel):
    email: EmailStr        # requires: pip install "pydantic[email]"
    website: HttpUrl
    age: PositiveInt
    password: SecretStr    # value is masked in repr/logs, .get_secret_value() to access
```

Pydantic ships ready-made types for extremely common validation needs — reach for
these before writing a custom regex validator for things like emails or URLs.

## Nested models — automatic recursive validation

```python
class Address(BaseModel):
    street: str
    city: str
    postal_code: str

class Customer(BaseModel):
    name: str
    address: Address        # nested model — validated recursively, automatically

customer = Customer(name="Bob", address={"street": "123 Main St", "city": "Springfield", "postal_code": "62704"})
print(customer.address.city)   # "Springfield" — the dict was parsed into a real Address instance
```

Pydantic handles nested validation automatically — pass a plain dict for a nested
model field, and it gets validated and converted into a real instance of that
nested model, recursively, with no extra code needed.

## `model_config` — configuring model behavior

```python
from pydantic import BaseModel, ConfigDict

class StrictConfig(BaseModel):
    model_config = ConfigDict(
        extra="forbid",       # reject unknown fields instead of silently ignoring them
        str_max_length=10,     # global string length cap
        frozen=True,            # immutable after creation — assignment raises an error
    )
    name: str
```

**`extra="forbid"` is the single highest-value config option for catching typos** —
by default, Pydantic silently ignores unknown input fields, which means a typo'd
config key (`databse_url` instead of `database_url`) is silently dropped rather
than raising an error. Set `extra="forbid"` on any model validating config files or
similarly typo-prone external input.

```python
class FooBarModel(BaseModel):
    model_config = ConfigDict(frozen=True)
    a: str

foobar = FooBarModel(a="hello")
foobar.a = "different"   # raises — frozen models can't be mutated after creation
```

`frozen=True` is useful for value objects that should never change after
construction — a common pattern for representing an immutable structured LLM
output or a validated config snapshot.

## Serialization — getting data back out

```python
from pydantic import BaseModel
from datetime import datetime

class Event(BaseModel):
    name: str
    start: datetime
    tags: list[str] = []
    internal_id: int = 0

event = Event(name="Launch", start="2026-03-01T10:00:00", tags=["product"])

event.model_dump()
# {'name': 'Launch', 'start': datetime(2026, 3, 1, 10, 0), 'tags': ['product'], 'internal_id': 0}

event.model_dump(mode="json")
# same, but all values are JSON-serializable (datetime → ISO string, etc.)

event.model_dump_json(indent=2)   # a JSON string directly, using the fast Rust serializer

event.model_dump(exclude={"internal_id"})       # drop specific fields
event.model_dump(include={"name", "start"})     # keep only specific fields
event.model_dump(exclude_unset=True)             # only fields explicitly passed at construction
```

`exclude_unset=True` is particularly useful for PATCH-style partial updates — it
tells you exactly which fields the caller actually provided, distinct from fields
that simply fell back to their default.

## Parsing data back into a model

```python
data = {"name": "Demo", "start": "2026-04-01T12:00:00"}
event2 = Event.model_validate(data)          # from a dict
event3 = Event.model_validate_json(json_str)  # from a JSON string directly
```

## Custom serialization

```python
from pydantic import BaseModel, field_serializer
from decimal import Decimal

class Invoice(BaseModel):
    amount: Decimal

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"    # control exactly how this field renders on output
```

## `TypeAdapter` — validating standalone types without a full model

```python
from pydantic import TypeAdapter

adapter = TypeAdapter(list[int])
adapter.validate_python(["1", "2", "3"])   # [1, 2, 3]
```

Useful when you need Pydantic's validation power for a type that isn't naturally a
`BaseModel` — a bare list, a `Union`, or any other type expression.

## When NOT to reach for Pydantic

If data never crosses a trust boundary — it's created and consumed entirely inside
your own code, with no external input, API, or file involved — a plain `dataclass`
is lighter and sufficient. **Pydantic earns its keep specifically at the edges**:
APIs, files, configuration, user input, and (in the agentic context this skill also
covers) LLM outputs.

## Practical guidance

1. **Always use `default_factory` for mutable field defaults** (lists, dicts).
2. **Reach for built-in types (`EmailStr`, `HttpUrl`, etc.) before writing custom
   regex validation** for common formats.
3. **Set `extra="forbid"` on models validating config or other typo-prone input.**
4. **Use `model_dump(exclude_unset=True)` for partial-update (PATCH) semantics.**
5. **Nested models validate recursively for free** — pass plain dicts, Pydantic
   converts them.