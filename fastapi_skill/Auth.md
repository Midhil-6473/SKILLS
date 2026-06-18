# Auth & Security Reference — FastAPI

## Table of Contents
1. [JWT Tokens — Full Implementation](#1-jwt-tokens)
2. [Refresh Tokens](#2-refresh-tokens)
3. [Role-Based Access Control (RBAC)](#3-rbac)
4. [API Key Authentication](#4-api-key-auth)
5. [OAuth2 Third-Party (Google, GitHub)](#5-oauth2-third-party)
6. [Rate Limiting](#6-rate-limiting)
7. [Security Headers](#7-security-headers)

---

## 1. JWT Tokens — Full Implementation

```python
# core/security.py
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: str | int, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {"sub": str(subject), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
```

```python
# api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from app.core.security import decode_token
from app import crud

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = crud.user.get(db, id=int(user_id))
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user = Depends(get_current_user),
):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
```

```python
# api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app import crud
from app.core.security import verify_password, create_access_token

router = APIRouter()

@router.post("/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = crud.user.get_by_email(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}
```

---

## 2. Refresh Tokens

```python
# core/security.py (additions)
def create_refresh_token(subject: str | int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {"sub": str(subject), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)

# Store refresh tokens in DB to allow revocation
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True)
    token = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    expires_at = Column(DateTime(timezone=True))
    revoked = Column(Boolean, default=False)

# auth.py endpoint
@router.post("/token")
async def login(form_data: ..., db: Session = Depends(get_db)):
    # ... validate user ...
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    # Store refresh token
    crud.refresh_token.create(db, token=refresh_token, user_id=user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/refresh")
async def refresh_access_token(refresh_token: str, db: Session = Depends(get_db)):
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    # Check it's not revoked
    stored = crud.refresh_token.get_by_token(db, token=refresh_token)
    if not stored or stored.revoked:
        raise HTTPException(status_code=401, detail="Token revoked")
    
    new_access_token = create_access_token(subject=int(user_id))
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(refresh_token: str, db: Session = Depends(get_db)):
    crud.refresh_token.revoke(db, token=refresh_token)
    return {"message": "Successfully logged out"}
```

---

## 3. RBAC

```python
from enum import Enum
from fastapi import Depends, HTTPException, status

class Role(str, Enum):
    user = "user"
    moderator = "moderator"
    admin = "admin"

# Permission levels
ROLE_HIERARCHY = {
    Role.user: 0,
    Role.moderator: 1,
    Role.admin: 2,
}

def require_role(minimum_role: Role):
    """Factory that returns a dependency requiring a minimum role."""
    async def role_checker(current_user = Depends(get_current_active_user)):
        user_level = ROLE_HIERARCHY.get(current_user.role, 0)
        required_level = ROLE_HIERARCHY[minimum_role]
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {minimum_role} role or higher",
            )
        return current_user
    return role_checker

# Usage
@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin = Depends(require_role(Role.admin)),
):
    ...

@router.get("/reports/")
async def get_reports(
    mod = Depends(require_role(Role.moderator)),
):
    ...
```

---

## 4. API Key Auth

```python
from fastapi.security import APIKeyHeader, APIKeyQuery

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
API_KEY_QUERY = APIKeyQuery(name="api_key", auto_error=False)

async def get_api_key(
    header_key: str = Depends(API_KEY_HEADER),
    query_key: str = Depends(API_KEY_QUERY),
    db: Session = Depends(get_db),
):
    key = header_key or query_key
    if not key:
        raise HTTPException(status_code=403, detail="API key required")
    
    api_key = crud.api_key.get_by_key(db, key=key)
    if not api_key or not api_key.is_active:
        raise HTTPException(status_code=403, detail="Invalid or inactive API key")
    
    return api_key

@router.get("/data/")
async def get_data(api_key = Depends(get_api_key)):
    ...
```

---

## 5. OAuth2 Third-Party (Google)

```bash
pip install authlib httpx
```

```python
from authlib.integrations.starlette_client import OAuth
from starlette.requests import Request
from starlette.responses import RedirectResponse

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

@router.get("/login/google")
async def google_login(request: Request):
    redirect_uri = request.url_for("google_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/auth/google")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")
    
    user = crud.user.get_by_email(db, email=user_info["email"])
    if not user:
        user = crud.user.create_oauth_user(db, email=user_info["email"], name=user_info["name"])
    
    access_token = create_access_token(subject=user.id)
    return RedirectResponse(url=f"/dashboard?token={access_token}")
```

---

## 6. Rate Limiting

```bash
pip install slowapi
```

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.post("/auth/token")
@limiter.limit("5/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    ...

@router.get("/items/")
@limiter.limit("100/minute")
async def list_items(request: Request):
    ...
```

---

## 7. Security Headers

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Only accept requests from known hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["example.com", "*.example.com", "localhost"],
)

# Add security headers via middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
```