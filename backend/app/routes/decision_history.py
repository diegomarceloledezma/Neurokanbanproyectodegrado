from typing import Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Project, ProjectMember, Task, TaskAssignmentHistory, User
from app.routes.auth import get_current_user, has_any_role
from app.schemas import DecisionHistoryItem, DecisionHistoryResponse

router = APIRouter(prefix="/decision-history", tags=["Decision History"])


def _get_accessible_project_ids(db: Session, current_user: User) -> Set[int]:
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


@router.get("/", response_model=DecisionHistoryResponse)
def get_decision_history(
    project_id: Optional[int] = Query(default=None),
    source: Optional[str] = Query(default=None),
    strategy: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver el historial de decisiones",
        )

    accessible_project_ids = _get_accessible_project_ids(db, current_user)

    if project_id is not None and not has_any_role(current_user, "admin"):
        if project_id not in accessible_project_ids:
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para ver ese proyecto",
            )

    query = (
        db.query(TaskAssignmentHistory)
        .options(
            joinedload(TaskAssignmentHistory.task),
            joinedload(TaskAssignmentHistory.assigned_user).joinedload(User.global_role),
        )
        .order_by(TaskAssignmentHistory.created_at.desc())
    )

    if project_id is not None:
        query = query.join(TaskAssignmentHistory.task).filter(Task.project_id == project_id)
    elif has_any_role(current_user, "leader"):
        if accessible_project_ids:
            query = query.join(TaskAssignmentHistory.task).filter(
                Task.project_id.in_(accessible_project_ids)
            )
        else:
            query = query.filter(False)

    if source:
        query = query.filter(TaskAssignmentHistory.source == source)

    if strategy:
        query = query.filter(TaskAssignmentHistory.strategy == strategy)

    records = query.limit(limit).all()

    items = []
    for record in records:
        task = record.task
        assigned_user = record.assigned_user

        items.append(
            DecisionHistoryItem(
                id=record.id,
                task_id=record.task_id,
                task_title=task.title if task else "Tarea no disponible",
                project_id=task.project_id if task else 0,
                task_status=task.status if task else "unknown",
                assigned_user_id=assigned_user.id if assigned_user else 0,
                assigned_user_name=assigned_user.full_name if assigned_user else "No disponible",
                assigned_user_role=assigned_user.global_role.name if assigned_user and assigned_user.global_role else "member",
                source=record.source,
                strategy=record.strategy,
                recommendation_score=float(record.recommendation_score or 0),
                risk_level=record.risk_level,
                reason=record.reason,
                recommendation_used=record.recommendation_used,
                created_at=record.created_at,
            )
        )

    return DecisionHistoryResponse(
        total_records=len(items),
        items=items,
    )