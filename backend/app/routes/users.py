from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import User
from app.schemas import UserBase, UserCreate
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["Users"])


def _normalize_username(value: str) -> str:
    return value.strip().lower()


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="La contraseña debe tener al menos 8 caracteres",
        )

    if not any(char.isupper() for char in password):
        raise HTTPException(
            status_code=400,
            detail="La contraseña debe incluir al menos una letra mayúscula",
        )

    if not any(char.islower() for char in password):
        raise HTTPException(
            status_code=400,
            detail="La contraseña debe incluir al menos una letra minúscula",
        )

    if not any(char.isdigit() for char in password):
        raise HTTPException(
            status_code=400,
            detail="La contraseña debe incluir al menos un número",
        )


@router.get("/", response_model=List[UserBase])
def get_users(db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .options(joinedload(User.global_role))
        .order_by(User.id.asc())
        .all()
    )
    return users


@router.get("/{user_id}", response_model=UserBase)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return user


@router.post("/register", response_model=UserBase)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    normalized_username = _normalize_username(payload.username)
    normalized_email = _normalize_email(payload.email)

    _validate_password_strength(payload.password)

    existing_user = (
        db.query(User)
        .filter(
            (func.lower(User.email) == normalized_email)
            | (func.lower(User.username) == normalized_username)
        )
        .first()
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="El usuario o correo ya existe")

    try:
        hashed_password = hash_password(payload.password)

        new_user = User(
            full_name=payload.full_name.strip(),
            username=normalized_username,
            email=normalized_email,
            password_hash=hashed_password,
            avatar_url=payload.avatar_url,
            global_role_id=payload.global_role_id,
            is_active=True,
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        user = (
            db.query(User)
            .options(joinedload(User.global_role))
            .filter(User.id == new_user.id)
            .first()
        )

        return user

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad en base de datos")
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al registrar el usuario")