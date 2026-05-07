from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Project, ProjectMember, Task, User
from app.routes.auth import get_current_user, has_any_role
from app.schemas import (
    AvailableUserItem,
    ProjectBase,
    ProjectCreate,
    ProjectMemberCreateRequest,
    ProjectMemberResponse,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


def _load_project_with_members(db: Session, project_id: int):
    return (
        db.query(Project)
        .options(
            joinedload(Project.team),
            joinedload(Project.area),
            joinedload(Project.creator).joinedload(User.global_role),
            joinedload(Project.members)
            .joinedload(ProjectMember.user)
            .joinedload(User.global_role),
        )
        .filter(Project.id == project_id)
        .first()
    )


def _is_project_member(db: Session, project_id: int, user_id: int) -> bool:
    return (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
        .first()
        is not None
    )


def _can_view_project(db: Session, project: Project, current_user: User) -> bool:
    if has_any_role(current_user, "admin"):
        return True

    if project.created_by == current_user.id:
        return True

    return _is_project_member(db, project.id, current_user.id)


def _can_manage_project(db: Session, project: Project, current_user: User) -> bool:
    if has_any_role(current_user, "admin"):
        return True

    if has_any_role(current_user, "leader"):
        if project.created_by == current_user.id:
            return True

        if _is_project_member(db, project.id, current_user.id):
            return True

    return False


@router.get("/", response_model=List[ProjectBase])
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = (
        db.query(Project)
        .options(
            joinedload(Project.team),
            joinedload(Project.area),
            joinedload(Project.creator).joinedload(User.global_role),
            joinedload(Project.members)
            .joinedload(ProjectMember.user)
            .joinedload(User.global_role),
        )
    )

    if has_any_role(current_user, "admin"):
        projects = base_query.order_by(Project.id.asc()).all()
        return projects

    projects = (
        base_query.outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(
            or_(
                Project.created_by == current_user.id,
                ProjectMember.user_id == current_user.id,
            )
        )
        .distinct()
        .order_by(Project.id.asc())
        .all()
    )

    return projects


@router.get("/{project_id}", response_model=ProjectBase)
def get_project_by_id(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _load_project_with_members(db, project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if not _can_view_project(db, project, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver este proyecto",
        )

    return project


@router.post("/", response_model=ProjectBase)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para crear proyectos",
        )

    try:
        new_project = Project(
            team_id=payload.team_id,
            area_id=payload.area_id,
            name=payload.name,
            description=payload.description,
            status=payload.status,
            start_date=payload.start_date,
            end_date=payload.end_date,
            created_by=current_user.id,
        )

        db.add(new_project)
        db.flush()

        creator_membership = ProjectMember(
            project_id=new_project.id,
            user_id=current_user.id,
            project_role="Líder del proyecto"
            if has_any_role(current_user, "leader")
            else "Administrador del proyecto",
            weekly_capacity_hours=40,
            availability_percentage=100,
        )

        db.add(creator_membership)
        db.commit()
        db.refresh(new_project)

        project = _load_project_with_members(db, new_project.id)
        return project

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo crear el proyecto")


@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
def get_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if not _can_view_project(db, project, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver los miembros de este proyecto",
        )

    members = (
        db.query(ProjectMember)
        .options(joinedload(ProjectMember.user).joinedload(User.global_role))
        .filter(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.id.asc())
        .all()
    )

    return members


@router.get("/{project_id}/available-users", response_model=List[AvailableUserItem])
def get_available_users_for_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if not _can_manage_project(db, project, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para gestionar integrantes en este proyecto",
        )

    subquery = db.query(ProjectMember.user_id).filter(ProjectMember.project_id == project_id)

    users = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.is_active.is_(True))
        .filter(~User.id.in_(subquery))
        .order_by(func.lower(User.full_name).asc())
        .all()
    )

    return [
        AvailableUserItem(
            id=user.id,
            full_name=user.full_name,
            username=user.username,
            email=user.email,
            role_name=user.global_role.name if user.global_role else None,
        )
        for user in users
    ]


@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
def add_member_to_project(
    project_id: int,
    payload: ProjectMemberCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if not _can_manage_project(db, project, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para agregar integrantes a este proyecto",
        )

    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.id == payload.user_id, User.is_active.is_(True))
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado o inactivo")

    existing = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == payload.user_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Ese usuario ya pertenece al proyecto")

    try:
        new_member = ProjectMember(
            project_id=project_id,
            user_id=payload.user_id,
            project_role=payload.project_role.strip(),
            weekly_capacity_hours=payload.weekly_capacity_hours,
            availability_percentage=payload.availability_percentage,
        )

        db.add(new_member)
        db.commit()
        db.refresh(new_member)

        member = (
            db.query(ProjectMember)
            .options(joinedload(ProjectMember.user).joinedload(User.global_role))
            .filter(ProjectMember.id == new_member.id)
            .first()
        )

        return member

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo agregar el integrante al proyecto")


@router.delete("/{project_id}/members/{member_id}")
def remove_member_from_project(
    project_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if not _can_manage_project(db, project, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para quitar integrantes de este proyecto",
        )

    member = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.id == member_id,
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=404, detail="Miembro del proyecto no encontrado")

    if member.user_id == project.created_by:
        raise HTTPException(
            status_code=400,
            detail="No se puede quitar al creador del proyecto",
        )

    assigned_tasks_count = (
        db.query(Task)
        .filter(Task.project_id == project_id, Task.assigned_to == member.user_id)
        .count()
    )

    if assigned_tasks_count > 0:
        raise HTTPException(
            status_code=400,
            detail="No se puede quitar al integrante porque todavía tiene tareas asignadas en este proyecto",
        )

    db.delete(member)
    db.commit()

    return {"message": "Integrante removido del proyecto correctamente"}