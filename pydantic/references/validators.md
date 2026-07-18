# Validators — `@field_validator`, `@model_validator`, Before/After/Wrap Modes

## `@field_validator` — single-field validation and transformation

```python
from pydantic import BaseModel, field_validator

class Model(BaseModel):
    number: int

    @field_validator("number")   # mode="after" by default
    @classmethod
    def is_even(cls, value: int) -> int:
        if value % 2 == 1:
            raise ValueError(f"{value} is not an even number")
        return value   # IMPORTANT: always return the validated value
```

```python
from pydantic import BaseModel, ValidationError

try:
    Model(number=1)
except ValidationError as err:
    print(err)
    # 1 validation error for Model
    # number
    #   Value error, 1 is not an even number [type=value_error, ...]
```

**Field validators must always `return` the value** — even if you're not
transforming it, the return value becomes the field's final validated value.
Raise `ValueError` (or `AssertionError`) to reject the input.

### Transforming, not just rejecting

```python
class Model(BaseModel):
    number: int

    @field_validator("number")
    @classmethod
    def double_number(cls, value: int) -> int:
        return value * 2

Model(number=2).number   # 4 — the validator transformed the value
```

Validators aren't only for rejection — returning a different value from what was
passed in is a normal, supported pattern for normalization/transformation (e.g.,
lowercasing an email, stripping whitespace, rounding a number).

## Before, After, and Wrap modes

```python
@field_validator("number", mode="before")   # runs BEFORE Pydantic's own coercion
@field_validator("number", mode="after")    # runs AFTER coercion (the default)
@field_validator("number", mode="wrap")     # wraps around Pydantic's own validation
```

| Mode | Runs | Receives | Use for |
|---|---|---|---|
| `before` | Before Pydantic's internal type coercion | The raw, untouched input (could be any type) | Preprocessing messy input before Pydantic tries to coerce it |
| `after` (default) | After coercion | The already-coerced, correctly-typed value | Business-rule validation on a value you know is the right type |
| `wrap` | Wraps around Pydantic's validation | A handler callable to invoke inner validation, plus the raw value | Advanced — full control, can skip/modify/short-circuit inner validation |

```python
from typing import Any
from pydantic import BaseModel, field_validator

class Model(BaseModel):
    numbers: list[int]

    @field_validator("numbers", mode="before")
    @classmethod
    def ensure_list(cls, value: Any) -> Any:
        # Raw input — could genuinely be anything, so type-check defensively
        if not isinstance(value, list):
            return [value]
        return value

Model(numbers=2).numbers   # [2] — a bare int was coerced into a single-item list
```

**Before validators receive untyped raw input** — they're more flexible but require
defensive handling since the input could be anything (this is why the type hint on
a before-validator's parameter is typically `Any`). **After validators receive an
already-correctly-typed value** — simpler to write, since you know the shape.

## Attaching validators via `Annotated` — reusable across models

```python
from typing import Annotated
from pydantic import BaseModel, AfterValidator, BeforeValidator

def double_number(value: int) -> int:
    return value * 2

class Model(BaseModel):
    number: Annotated[int, AfterValidator(double_number)]
```

This form binds a validator function to a **type**, not a specific field name —
useful when the same validation logic (e.g., "must be a valid US ZIP code") is
reused across multiple models/fields, since you define it once and attach it via
`Annotated` wherever needed, rather than redefining a `@field_validator` in every
model.

## `@model_validator` — cross-field validation

```python
from pydantic import BaseModel, model_validator
from datetime import date, timedelta

class Reservation(BaseModel):
    check_in: date
    check_out: date
    room_type: str
    guests: int

    @model_validator(mode="after")
    def validate_stay(self) -> "Reservation":
        if self.check_out <= self.check_in:
            raise ValueError("Check-out must be after check-in")

        max_stay = timedelta(days=30)
        if self.check_out - self.check_in > max_stay:
            raise ValueError("Maximum stay is 30 days")

        room_capacity = {"single": 1, "double": 2, "suite": 4, "penthouse": 6}
        max_guests = room_capacity.get(self.room_type, 2)
        if self.guests > max_guests:
            raise ValueError(f"{self.room_type.title()} room accommodates max {max_guests} guests")

        return self   # IMPORTANT: after-mode model validators must return self
```

**Use `@field_validator` for single-field logic; `@model_validator` for anything
comparing multiple fields to each other** — cross-field business rules (date
ranges, conditional requirements, capacity checks) belong at the model level, not
awkwardly bolted onto a single field's validator.

**Always `return self`** from an after-mode model validator — this is the most
common mistake when first writing one; forgetting the return silently produces
`None` instead of the validated model.

### `@model_validator(mode="before")` — preprocessing raw input

```python
class Payment(BaseModel):
    method: str
    card_number: str | None = None
    account_number: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_input(cls, data: Any) -> Any:
        if isinstance(data, dict) and "cardNumber" in data:
            data["card_number"] = data.pop("cardNumber")   # normalize a camelCase API payload
        return data
```

## Conditional validation based on another field

```python
from typing import Literal, Optional
from pydantic import BaseModel, model_validator

class Payment(BaseModel):
    method: Literal["card", "bank_transfer"]
    card_number: Optional[str] = None
    account_number: Optional[str] = None

    @model_validator(mode="after")
    def check_required_fields(self) -> "Payment":
        if self.method == "card" and not self.card_number:
            raise ValueError("card_number is required when method is 'card'")
        if self.method == "bank_transfer" and not self.account_number:
            raise ValueError("account_number is required when method is 'bank_transfer'")
        return self
```

A very common real-world pattern: different required fields depending on a
discriminating field's value — model-level `after` validators are the right place
for this (see also `structured_outputs.md` for discriminated unions, a more
type-strict alternative for this exact scenario).

## Async validation — Pydantic validators are synchronous

Pydantic's validators run synchronously — for validation that genuinely needs to
be async (e.g., checking a coupon code against a database), validate in two steps
rather than trying to force async work into a validator:

```python
from pydantic import BaseModel

class OrderInput(BaseModel):
    """Step 1: structural/synchronous validation only."""
    coupon_code: str
    amount: float

async def validate_order(raw_data: dict) -> OrderInput:
    """Step 2: async business-rule validation, outside the Pydantic model."""
    order = OrderInput.model_validate(raw_data)   # sync structural validation
    coupon = await db.get_coupon(order.coupon_code)
    if coupon is None:
        raise ValueError("Invalid coupon code")
    return order
```

## Validator execution order

When multiple validators are stacked, order matters: before/plain validators run
first (in the order attached), then Pydantic's own internal coercion, then
after validators (in the order attached), with wrap validators sandwiching the
whole process. In practice, keep it simple — most models only need one or two
validators per field, and complex chained-validator ordering is rarely necessary.

## Practical guidance

1. **`@field_validator` for one field, `@model_validator(mode="after")` for
   relationships between fields** — this is the core decision to make correctly.
2. **Always `return` the value from a field validator, always `return self` from
   an after-mode model validator.**
3. **Use `mode="before"` only when you genuinely need to handle raw, untyped
   input** — prefer `mode="after"` (the default) whenever the value is already the
   right type by the time your logic needs to run.
4. **For reusable validation logic across many models, attach via `Annotated` +
   `AfterValidator`/`BeforeValidator`** rather than duplicating a `@field_validator`
   in each model.
5. **Validate in two steps for anything requiring async work** — Pydantic
   validators themselves are synchronous.