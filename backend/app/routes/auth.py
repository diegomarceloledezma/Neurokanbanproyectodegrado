from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.db import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserBase
from app.security import verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

security = HTTPBearer()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(
            or_(
                User.username == payload.username_or_email,
                User.email == payload.username_or_email
            )
        )
        .first()
    )

    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = create_access_token(
        {
            "sub": str(user.id),
            "username": user.username,
            "role": user.global_role.name if user.global_role else None
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )

    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.id == int(user_id))
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )

    return user


@router.get("/me", response_model=UserBase)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user