from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import (
    BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_FULL_NAME,
    BOOTSTRAP_ADMIN_PASSWORD,
    BOOTSTRAP_ADMIN_USERNAME,
    BOOTSTRAP_DEFAULT_ADMIN,
)
from app.models import Area, Role, Skill, User
from app.security import hash_password


@dataclass(frozen=True)
class BootstrapResult:
    roles_created: int = 0
    areas_created: int = 0
    skills_created: int = 0
    admin_created: bool = False
    admin_username: str | None = None
    admin_email: str | None = None


DEFAULT_ROLES: tuple[tuple[str, str], ...] = (
    ("admin", "Administrador general del sistema"),
    ("leader", "Líder de equipo"),
    ("member", "Integrante del equipo"),
)

DEFAULT_AREAS: tuple[tuple[str, str], ...] = (
    ("Software", "Desarrollo de software"),
    ("Diseño", "Diseño gráfico y UX/UI"),
    ("Marketing", "Marketing y contenido"),
    ("Administración", "Gestión administrativa"),
    ("Multidisciplinario", "Equipos con distintas áreas"),
)

DEFAULT_SKILLS: tuple[tuple[str, str, str], ...] = (
    ("React", "Frontend", "Desarrollo de interfaces"),
    ("TypeScript", "Frontend", "Desarrollo frontend tipado"),
    ("FastAPI", "Backend", "APIs con Python"),
    ("PostgreSQL", "Base de Datos", "Diseño y consultas SQL"),
    ("UX/UI", "Diseño", "Diseño de experiencia e interfaces"),
    ("Documentación", "Gestión", "Redacción y documentación técnica"),
    ("Investigación", "Análisis", "Levantamiento y análisis de información"),
    ("Redacción", "Comunicación", "Producción de textos y copy"),
    ("Coordinación", "Operaciones", "Gestión operativa y seguimiento"),
)


def _normalize(value: str) -> str:
    return value.strip().lower()


def _get_or_create_role(db: Session, name: str, description: str) -> tuple[Role, bool]:
    role = db.query(Role).filter(Role.name == name).first()
    if role:
        return role, False

    role = Role(name=name, description=description)
    db.add(role)
    db.flush()
    return role, True


def _get_or_create_area(db: Session, name: str, description: str) -> tuple[Area, bool]:
    area = db.query(Area).filter(Area.name == name).first()
    if area:
        return area, False

    area = Area(name=name, description=description)
    db.add(area)
    db.flush()
    return area, True


def _get_or_create_skill(
    db: Session,
    name: str,
    category: str,
    description: str,
    default_area_id: int | None,
) -> tuple[Skill, bool]:
    skill = db.query(Skill).filter(Skill.name == name).first()
    if skill:
        return skill, False

    skill = Skill(
        name=name,
        canonical_name=name,
        category=category,
        area_id=default_area_id,
        description=description,
        source_name="NeuroKanban bootstrap",
        source_code="internal_catalog",
        source_version="1.0",
        is_active=True,
    )
    db.add(skill)
    db.flush()
    return skill, True


def bootstrap_catalog(db: Session) -> tuple[int, int, int, Role | None, Area | None]:
    roles_created = 0
    areas_created = 0
    skills_created = 0

    admin_role: Role | None = None
    default_area: Area | None = None

    for name, description in DEFAULT_ROLES:
        role, created = _get_or_create_role(db, name, description)
        if created:
            roles_created += 1
        if name == "admin":
            admin_role = role

    for name, description in DEFAULT_AREAS:
        area, created = _get_or_create_area(db, name, description)
        if created:
            areas_created += 1
        if name == "Multidisciplinario":
            default_area = area

    default_area_id = default_area.id if default_area else None
    for name, category, description in DEFAULT_SKILLS:
        _, created = _get_or_create_skill(db, name, category, description, default_area_id)
        if created:
            skills_created += 1

    return roles_created, areas_created, skills_created, admin_role, default_area


def bootstrap_default_admin(db: Session, admin_role: Role | None) -> tuple[bool, str | None, str | None]:
    if not BOOTSTRAP_DEFAULT_ADMIN:
        return False, None, None

    if not admin_role:
        admin_role = db.query(Role).filter(Role.name == "admin").first()

    if not admin_role:
        return False, None, None

    normalized_username = _normalize(BOOTSTRAP_ADMIN_USERNAME)
    normalized_email = _normalize(BOOTSTRAP_ADMIN_EMAIL)

    existing_admin = (
        db.query(User)
        .filter(
            (User.username == normalized_username)
            | (User.email == normalized_email)
            | (User.global_role_id == admin_role.id)
        )
        .first()
    )

    if existing_admin:
        return False, existing_admin.username, existing_admin.email

    admin = User(
        full_name=BOOTSTRAP_ADMIN_FULL_NAME.strip() or "Administrador NeuroKanban",
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(BOOTSTRAP_ADMIN_PASSWORD),
        global_role_id=admin_role.id,
        is_active=True,
    )
    db.add(admin)
    db.flush()

    return True, admin.username, admin.email


def bootstrap_application(db: Session) -> BootstrapResult:
    """Create minimum catalog data needed by a fresh Docker/AWS deployment.

    This function is idempotent: it can run multiple times without duplicating roles,
    areas, skills or the first administrator account.
    """

    try:
        roles_created, areas_created, skills_created, admin_role, _ = bootstrap_catalog(db)
        admin_created, admin_username, admin_email = bootstrap_default_admin(db, admin_role)
        db.commit()

        return BootstrapResult(
            roles_created=roles_created,
            areas_created=areas_created,
            skills_created=skills_created,
            admin_created=admin_created,
            admin_username=admin_username,
            admin_email=admin_email,
        )
    except IntegrityError:
        db.rollback()
        return BootstrapResult()
    except Exception:
        db.rollback()
        raise