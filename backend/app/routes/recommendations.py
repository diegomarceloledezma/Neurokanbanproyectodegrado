from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.routes.auth import get_current_user, has_any_role
from app.schemas import TaskInsightResponse
from app.services.recommendation_engine import (
    ALLOWED_MODES,
    ALLOWED_STRATEGIES,
    build_task_recommendations_response,
    build_task_simulation_response,
    load_task_or_none,
)
from app.services.task_insights_service import build_task_insight_response

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


def _get_accessible_project_ids(db: Session, current_user: User) -> set[int]:
    from app.models import Project, ProjectMember

    if has_any_role(current_user, "admin"):
        rows = db.query(Project.id).all()
        return {int(project_id) for (project_id,) in rows}

    membership_rows = (
        db.query(ProjectMember.project_id)
        .filter(ProjectMember.user_id == current_user.id)
        .all()
    )
    project_ids = {int(project_id) for (project_id,) in membership_rows}

    if has_any_role(current_user, "leader"):
        created_rows = (
            db.query(Project.id)
            .filter(Project.created_by == current_user.id)
            .all()
        )
        project_ids.update(int(project_id) for (project_id,) in created_rows)

    return project_ids


def _validate_task_access(db: Session, task, current_user: User) -> None:
    if has_any_role(current_user, "admin"):
        return

    accessible_project_ids = _get_accessible_project_ids(db, current_user)

    if has_any_role(current_user, "leader"):
        if task.project_id not in accessible_project_ids:
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para acceder a esa tarea",
            )
        return

    if has_any_role(current_user, "member"):
        if task.project_id not in accessible_project_ids:
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para acceder a esa tarea",
            )
        return

    raise HTTPException(
        status_code=403,
        detail="No tienes permisos para usar recomendaciones inteligentes",
    )


def _validate_strategy_and_mode(strategy: str, mode: str) -> None:
    if strategy not in ALLOWED_STRATEGIES:
        raise HTTPException(
            status_code=400,
            detail=f"Estrategia inválida. Usa una de: {', '.join(sorted(ALLOWED_STRATEGIES))}",
        )

    if mode not in ALLOWED_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Modo inválido. Usa uno de: {', '.join(sorted(ALLOWED_MODES))}",
        )


@router.get("/tasks/{task_id}")
def get_task_recommendations(
    task_id: int,
    strategy: str = Query(default="balance"),
    mode: str = Query(default="hybrid"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_strategy_and_mode(strategy, mode)

    task = load_task_or_none(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    _validate_task_access(db, task, current_user)

    response = build_task_recommendations_response(db, task, strategy, mode)
    if not response:
        raise HTTPException(
            status_code=404,
            detail="No se encontraron integrantes elegibles para recomendar",
        )

    return response


@router.get("/tasks/{task_id}/simulation")
def get_task_simulation(
    task_id: int,
    strategy: str = Query(default="balance"),
    mode: str = Query(default="hybrid"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_strategy_and_mode(strategy, mode)

    task = load_task_or_none(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    _validate_task_access(db, task, current_user)

    response = build_task_simulation_response(db, task, strategy, mode)
    if not response:
        raise HTTPException(
            status_code=404,
            detail="No se encontraron integrantes elegibles para simular",
        )

    return response


@router.get("/tasks/{task_id}/insights", response_model=TaskInsightResponse)
def get_task_insights(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = load_task_or_none(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    _validate_task_access(db, task, current_user)

    return build_task_insight_response(task)