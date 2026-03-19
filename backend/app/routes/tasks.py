from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Task, User, TaskAssignmentHistory
from app.schemas import TaskBase, TaskCreate, TaskAssignRequest, AssignmentHistoryItem

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/project/{project_id}", response_model=List[TaskBase])
def get_tasks_by_project(project_id: int, db: Session = Depends(get_db)):
    tasks = (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
        )
        .filter(Task.project_id == project_id)
        .order_by(Task.id.asc())
        .all()
    )
    return tasks


@router.get("/{task_id}", response_model=TaskBase)
def get_task_by_id(task_id: int, db: Session = Depends(get_db)):
    task = (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
        )
        .filter(Task.id == task_id)
        .first()
    )

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
    db.commit()
    db.refresh(new_task)

    task = (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
        )
        .filter(Task.id == new_task.id)
        .first()
    )

    return task


@router.patch("/{task_id}/assign", response_model=TaskBase)
def assign_task(task_id: int, payload: TaskAssignRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.id == payload.assigned_to, User.is_active == True)
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Integrante no encontrado o inactivo")

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
    )

    db.add(history)
    db.commit()
    db.refresh(task)

    updated_task = (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
        )
        .filter(Task.id == task.id)
        .first()
    )

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