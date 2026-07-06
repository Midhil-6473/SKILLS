# Testing Reference — FastAPI

## Table of Contents
1. [Setup & Configuration](#1-setup)
2. [Fixtures](#2-fixtures)
3. [Sync Tests](#3-sync-tests)
4. [Async Tests](#4-async-tests)
5. [Mocking Dependencies](#5-mocking)
6. [Auth in Tests](#6-auth-in-tests)
7. [Coverage & CI](#7-coverage)

---

## 1. Setup

```bash
pip install pytest pytest-asyncio httpx
```

`pyproject.toml`:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## 2. Fixtures

```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db.session import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app import crud
from app.schemas.user import UserCreate

# Use SQLite in-memory for tests — fast, no setup needed
TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    """Fresh DB for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    """Sync TestClient with DB override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
async def async_client(db):
    """Async client for async endpoints."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db):
    user_in = UserCreate(email="test@example.com", password="testpassword123")
    return crud.user.create(db, obj_in=user_in)

@pytest.fixture
def auth_headers(test_user):
    token = create_access_token(subject=test_user.id)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_headers(db):
    admin = crud.user.create(db, obj_in=UserCreate(email="admin@example.com", password="admin123"))
    crud.user.update(db, db_obj=admin, obj_in={"role": "admin"})
    token = create_access_token(subject=admin.id)
    return {"Authorization": f"Bearer {token}"}
```

---

## 3. Sync Tests

```python
# tests/api/test_items.py
def test_create_item_success(client, auth_headers):
    response = client.post(
        "/api/v1/items/",
        json={"name": "Widget", "price": 9.99},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Widget"
    assert data["price"] == 9.99
    assert "id" in data

def test_create_item_invalid_price(client, auth_headers):
    response = client.post(
        "/api/v1/items/",
        json={"name": "Widget", "price": -5.0},
        headers=auth_headers,
    )
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any("price" in str(e) for e in errors)

def test_get_item_not_found(client, auth_headers):
    response = client.get("/api/v1/items/99999", headers=auth_headers)
    assert response.status_code == 404

def test_list_items_pagination(client, auth_headers, db):
    # Create 5 items
    for i in range(5):
        crud.item.create(db, obj_in=ItemCreate(name=f"Item {i}", price=float(i + 1)))
    
    response = client.get("/api/v1/items/?skip=2&limit=2", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

def test_unauthenticated_request(client):
    response = client.get("/api/v1/items/")
    assert response.status_code == 401

def test_delete_item_forbidden(client, auth_headers, db):
    """Regular users cannot delete items."""
    item = crud.item.create(db, obj_in=ItemCreate(name="Test", price=1.0))
    response = client.delete(f"/api/v1/items/{item.id}", headers=auth_headers)
    assert response.status_code == 403
```

---

## 4. Async Tests

```python
# tests/api/test_async.py
import pytest

@pytest.mark.asyncio
async def test_create_item_async(async_client, auth_headers):
    response = await async_client.post(
        "/api/v1/items/",
        json={"name": "Async Widget", "price": 5.0},
        headers=auth_headers,
    )
    assert response.status_code == 201

@pytest.mark.asyncio
async def test_websocket_connection(async_client):
    async with async_client.websocket_connect("/ws/test-user") as ws:
        await ws.send_text("Hello")
        data = await ws.receive_text()
        assert "test-user" in data
```

---

## 5. Mocking Dependencies

```python
from unittest.mock import MagicMock, patch, AsyncMock
from app.api.deps import get_current_user

# Mock an external service
def test_item_creation_sends_email(client, auth_headers):
    with patch("app.services.email.send_welcome_email") as mock_email:
        response = client.post("/api/v1/items/", json={...}, headers=auth_headers)
        assert response.status_code == 201
        mock_email.assert_called_once()

# Override a dependency entirely
def test_admin_endpoint(client):
    mock_admin = MagicMock()
    mock_admin.role = "admin"
    mock_admin.is_active = True
    
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    response = client.delete("/api/v1/users/1")
    assert response.status_code == 200
    app.dependency_overrides.clear()

# Mock async function
async def test_external_api_call(async_client, auth_headers):
    with patch("app.services.weather.fetch_weather", new_callable=AsyncMock) as mock:
        mock.return_value = {"temp": 25, "condition": "sunny"}
        response = await async_client.get("/api/v1/weather/", headers=auth_headers)
        assert response.status_code == 200
```

---

## 6. Auth in Tests

```python
# tests/api/test_auth.py
def test_login_success(client, test_user):
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "test@example.com", "password": "testpassword123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password(client, test_user):
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "test@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401

def test_login_nonexistent_user(client):
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "nobody@example.com", "password": "anything"},
    )
    assert response.status_code == 401

def test_protected_endpoint_with_token(client, auth_headers):
    response = client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

def test_expired_token(client):
    from datetime import timedelta
    expired_token = create_access_token(subject=1, expires_delta=timedelta(seconds=-1))
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
```

---

## 7. Coverage & CI

```bash
pip install pytest-cov

# Run with coverage
pytest --cov=app --cov-report=html --cov-report=term-missing

# Fail if coverage drops below threshold
pytest --cov=app --cov-fail-under=80
```

`.github/workflows/test.yml`:
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements-dev.txt
      - run: pytest --cov=app --cov-fail-under=80
        env:
          DATABASE_URL: postgresql://test:test@localhost/test
          SECRET_KEY: test-secret-key-not-for-production
```