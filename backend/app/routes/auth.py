from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserBase
from app.security import create_access_token, decode_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])

security = HTTPBearer()

MAX_FAILED_ATTEMPTS = 5
LOCK_MINUTES = 15
ATTEMPT_WINDOW_MINUTES = 15

_login_attempts_store: dict[str, dict[str, Any]] = {}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_identifier(value: str) -> str:
    return value.strip().lower()


def _build_attempt_key(ip_address: str, identifier: str) -> str:
    return f"{ip_address}:{identifier}"


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def _cleanup_attempt_record(record: dict[str, Any]) -> dict[str, Any]:
    now = _utc_now()
    first_failed_at = record.get("first_failed_at")
    locked_until = record.get("locked_until")

    if locked_until and now >= locked_until:
        return {
            "count": 0,
            "first_failed_at": None,
            "locked_until": None,
        }

    if first_failed_at and now - first_failed_at > timedelta(minutes=ATTEMPT_WINDOW_MINUTES):
        return {
            "count": 0,
            "first_failed_at": None,
            "locked_until": None,
        }

    return record


def _get_attempt_record(key: str) -> dict[str, Any]:
    record = _login_attempts_store.get(
        key,
        {
            "count": 0,
            "first_failed_at": None,
            "locked_until": None,
        },
    )
    record = _cleanup_attempt_record(record)
    _login_attempts_store[key] = record
    return record


def _register_failed_attempt(key: str) -> dict[str, Any]:
    now = _utc_now()
    record = _get_attempt_record(key)

    if record["count"] == 0 or record["first_failed_at"] is None:
        record["first_failed_at"] = now

    record["count"] += 1

    if record["count"] >= MAX_FAILED_ATTEMPTS:
        record["locked_until"] = now + timedelta(minutes=LOCK_MINUTES)

    _login_attempts_store[key] = record
    return record


def _clear_failed_attempts(key: str) -> None:
    if key in _login_attempts_store:
        del _login_attempts_store[key]


def get_role_name(user: User | None) -> str:
    if not user or not user.global_role or not user.global_role.name:
        return ""
    return user.global_role.name.strip().lower()


def has_any_role(user: User | None, *roles: str) -> bool:
    current_role = get_role_name(user)
    normalized_roles = {role.strip().lower() for role in roles}
    return current_role in normalized_roles


def require_roles(*roles: str) -> Callable:
    normalized_roles = {role.strip().lower() for role in roles}

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        current_role = get_role_name(current_user)

        if current_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción",
            )

        return current_user

    return dependency


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_identifier = _normalize_identifier(payload.username_or_email)
    client_ip = _get_client_ip(request)
    attempt_key = _build_attempt_key(client_ip, normalized_identifier)

    attempt_record = _get_attempt_record(attempt_key)
    locked_until = attempt_record.get("locked_until")

    if locked_until and _utc_now() < locked_until:
        remaining_seconds = int((locked_until - _utc_now()).total_seconds())
        raise HTTPException(
            status_code=429,
            detail=(
                "Demasiados intentos fallidos. "
                f"Vuelve a intentar en aproximadamente {remaining_seconds} segundos."
            ),
        )

    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(
            or_(
                func.lower(User.username) == normalized_identifier,
                func.lower(User.email) == normalized_identifier,
            )
        )
        .first()
    )

    valid_user = bool(user and user.is_active)
    valid_password = bool(user and verify_password(payload.password, user.password_hash))

    if not valid_user or not valid_password:
        failed_record = _register_failed_attempt(attempt_key)

        if failed_record.get("locked_until") and _utc_now() < failed_record["locked_until"]:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Demasiados intentos fallidos. "
                    "Tu acceso fue bloqueado temporalmente por seguridad."
                ),
            )

        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    _clear_failed_attempts(attempt_key)

    token = create_access_token(
        {
            "sub": str(user.id),
            "username": user.username,
            "role": user.global_role.name if user.global_role else None,
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.id == int(user_id))
        .first()
    )

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )

    return user


@router.get("/me", response_model=UserBase)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user