from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import ProjectMember, Task, TaskAssignmentHistory, TaskRequiredSkill, User
from app.schemas import (
    AssignmentHistoryDetailedItem,
    AssignmentHistoryItem,
    TaskAssignRequest,
    TaskBase,
    TaskCreate,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _load_task_with_relations(db: Session, task_id: int):
    return (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
            joinedload(Task.required_skills).joinedload(TaskRequiredSkill.skill),
        )
        .filter(Task.id == task_id)
        .first()
    )


@router.get("/project/{project_id}", response_model=List[TaskBase])
def get_tasks_by_project(project_id: int, db: Session = Depends(get_db)):
    tasks = (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
            joinedload(Task.required_skills).joinedload(TaskRequiredSkill.skill),
        )
        .filter(Task.project_id == project_id)
        .order_by(Task.id.asc())
        .all()
    )
    return tasks


@router.get("/assignment-history", response_model=List[AssignmentHistoryDetailedItem])
def get_assignment_history(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(TaskAssignmentHistory)
        .options(
            joinedload(TaskAssignmentHistory.task),
            joinedload(TaskAssignmentHistory.assigned_user).joinedload(User.global_role),
            joinedload(TaskAssignmentHistory.assigned_by_user).joinedload(User.global_role),
        )
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
    )

    if project_id is not None:
        query = query.filter(Task.project_id == project_id)

    history = query.order_by(TaskAssignmentHistory.created_at.desc()).all()
    return history


@router.get("/{task_id}", response_model=TaskBase)
def get_task_by_id(task_id: int, db: Session = Depends(get_db)):
    task = _load_task_with_relations(db, task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    return task


@router.post("/", response_model=TaskBase)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    new_task = Task(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        task_type=payload.task_type,
        priority=payload.priority,
        complexity=payload.complexity,
        status=payload.status,
        estimated_hours=payload.estimated_hours,
        actual_hours=payload.actual_hours,
        due_date=payload.due_date,
        created_by=payload.created_by,
        assigned_to=payload.assigned_to,
    )

    db.add(new_task)
    db.flush()

    for required_skill in payload.required_skills:
        db.add(
            TaskRequiredSkill(
                task_id=new_task.id,
                skill_id=required_skill.skill_id,
                required_level=required_skill.required_level,
            )
        )

    db.commit()

    task = _load_task_with_relations(db, new_task.id)
    return task


@router.patch("/{task_id}/assign", response_model=TaskBase)
def assign_task(task_id: int, payload: TaskAssignRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.id == payload.assigned_to, User.is_active.is_(True))
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Integrante no encontrado o inactivo")

    project_membership = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == task.project_id,
            ProjectMember.user_id == payload.assigned_to,
        )
        .first()
    )

    if not project_membership:
        raise HTTPException(
            status_code=400,
            detail="El integrante seleccionado no pertenece al proyecto de la tarea",
        )

    task.assigned_to = payload.assigned_to

    history = TaskAssignmentHistory(
        task_id=task.id,
        assigned_to=payload.assigned_to,
        assigned_by=payload.assigned_by,
        source=payload.source,
        strategy=payload.strategy,
        recommendation_score=payload.recommendation_score,
        risk_level=payload.risk_level,
        reason=payload.reason,
        recommendation_used=payload.recommendation_used,
    )

    db.add(history)
    db.commit()

    updated_task = _load_task_with_relations(db, task.id)
    return updated_task


@router.get("/{task_id}/assignment-history", response_model=List[AssignmentHistoryItem])
def get_task_assignment_history(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    history = (
        db.query(TaskAssignmentHistory)
        .filter(TaskAssignmentHistory.task_id == task_id)
        .order_by(TaskAssignmentHistory.created_at.desc())
        .all()
    )

    return history