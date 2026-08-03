# Settings Management — `pydantic-settings`, Environment Variables, `.env` Files

## Why not just use `os.environ` directly

`os.environ.get("PORT")` returns a string (or `None`) with no validation, no type
coercion, and no single place documenting what configuration your app actually
expects. `pydantic-settings` turns environment-based configuration into a validated
Pydantic model — catching missing or malformed config **at startup**, loudly,
rather than as a mysterious runtime failure deep in your application logic.

```bash
pip install pydantic-settings
```

## Basic settings model

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "MyApp"
    debug: bool = False
    secret_key: str          # required — no default, so missing this raises at startup
    database_url: str

settings = Settings()   # reads from environment variables automatically
```

By default, each field maps to an environment variable of the same name
(case-insensitive) — `secret_key` reads from `SECRET_KEY`, `database_url` reads
from `DATABASE_URL`, with no extra configuration needed.

## Loading from a `.env` file

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    app_name: str = "MyApp"
    secret_key: str
    database_url: str
```

```bash
# .env
APP_NAME=MyApp
SECRET_KEY=super-secret-value
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
```

**Never commit a `.env` file containing real secrets to version control** —
`.env` should always be listed in `.gitignore`; commit a `.env.example` template
with placeholder values instead.

## Nested settings

```python
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class DatabaseSettings(BaseModel):
    host: str = "localhost"
    port: int = 5432
    name: str
    user: str = "postgres"
    password: str = Field(..., repr=False)   # hide from repr/logs

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_nested_delimiter="__",    # nested field via DATABASE__HOST syntax
    )

    app_name: str = "MyApp"
    debug: bool = False
    database: DatabaseSettings
    allowed_hosts: list[str] = ["localhost"]
```

```bash
# .env — DATABASE__HOST maps to settings.database.host, via the nested delimiter
DATABASE__HOST=postgres.example.com
DATABASE__NAME=mydb
DATABASE__PASSWORD=secret
ALLOWED_HOSTS=["localhost","example.com"]
```

`env_nested_delimiter="__"` lets a flat environment variable namespace
(`DATABASE__HOST`, `DATABASE__PORT`) populate a properly nested settings structure —
useful for keeping related configuration grouped in code while still working with
standard flat environment variables in deployment.

## `SecretStr` for sensitive values

```python
from pydantic import SecretStr
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    api_key: SecretStr

settings = Settings()
print(settings.api_key)                    # SecretStr('**********')  — masked
print(settings.api_key.get_secret_value())  # the actual value, explicitly requested
```

`SecretStr` prevents credentials from accidentally leaking into logs, error
messages, or `repr()` output — the value is masked everywhere except when
explicitly unwrapped via `.get_secret_value()`, which makes accidental exposure a
deliberate, visible code change rather than a silent default.

## Namespacing with `env_prefix`

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MYAPP_")
    debug: bool = False    # reads from MYAPP_DEBUG, not DEBUG
```

Useful when deploying multiple services in a shared environment where bare
variable names like `DEBUG` or `PORT` could collide across services.

## Validating settings once, at import/startup time

```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    anthropic_api_key: str

settings = Settings()   # validated ONCE here — fails fast at import if misconfigured
```

```python
# main.py
from config import settings   # reuse the single validated instance everywhere

print(settings.database_url)
```

**Instantiate `Settings()` once, in a dedicated `config.py`, and import the single
instance everywhere else** — don't re-instantiate `Settings()` repeatedly
throughout the codebase. This gives you a single, fail-fast validation point at
startup (a missing required env var crashes immediately with a clear error,
instead of failing mysteriously mid-request later) and one obvious place to look
for what configuration the app expects.

## Using settings inside FastAPI (see also `fastapi_integration.md`)

```python
from fastapi import FastAPI, Depends
from functools import lru_cache
from config import Settings

@lru_cache
def get_settings() -> Settings:
    return Settings()

app = FastAPI()

@app.get("/info")
async def info(settings: Settings = Depends(get_settings)):
    return {"app_name": settings.app_name}
```

`lru_cache` on the settings-provider function ensures settings are validated once
and reused across requests via FastAPI's dependency injection, rather than
re-reading environment variables on every single request.

## Practical guidance

1. **Never read `os.environ` directly for application configuration** — always go
   through a `pydantic-settings` model, for validation and a single documented
   source of truth.
2. **Use `SecretStr` for any credential** — API keys, passwords, tokens.
3. **Validate settings once at startup**, in a dedicated module, and reuse the
   single instance — don't re-instantiate repeatedly.
4. **Never commit `.env` with real values** — commit a `.env.example` template
   instead, and ensure `.env` is gitignored.
5. **Use `env_nested_delimiter` for structured config** (e.g., grouped database
   settings) rather than flattening everything into a single-level model.