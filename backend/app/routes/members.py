from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import User, Task
from app.schemas import MemberProfileResponse, MemberTaskItem

router = APIRouter(prefix="/members", tags=["Members"])


@router.get("/{member_id}/profile", response_model=MemberProfileResponse)
def get_member_profile(member_id: int, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.id == member_id)
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    assigned_tasks = (
        db.query(Task)
        .filter(Task.assigned_to == member_id)
        .order_by(Task.id.asc())
        .all()
    )

    active_statuses = {"pending", "in_progress", "review", "blocked"}
    completed_statuses = {"done"}

    active_tasks = [task for task in assigned_tasks if task.status in active_statuses]
    completed_tasks = [task for task in assigned_tasks if task.status in completed_statuses]

    total_tasks = len(assigned_tasks)
    active_count = len(active_tasks)
    completed_count = len(completed_tasks)

    completion_rate = round((completed_count / total_tasks) * 100, 2) if total_tasks > 0 else 0.0

    total_active_hours = 0.0
    for task in active_tasks:
        if task.estimated_hours is not None:
            total_active_hours += float(task.estimated_hours)

    current_load = round(min((total_active_hours / 40) * 100, 100), 2)
    availability = round(max(100 - current_load, 0), 2)

    return MemberProfileResponse(
        id=user.id,
        full_name=user.full_name,
        username=user.username,
        email=user.email,
        avatar_url=user.avatar_url,
        role_name=user.global_role.name if user.global_role else "member",
        active_tasks=active_count,
        completed_tasks=completed_count,
        total_tasks=total_tasks,
        completion_rate=completion_rate,
        current_load=current_load,
        availability=availability,
        experience_level=None,
        active_task_items=[
            MemberTaskItem(
                id=task.id,
                title=task.title,
                priority=task.priority,
                status=task.status,
                complexity=task.complexity,
                estimated_hours=float(task.estimated_hours) if task.estimated_hours is not None else None,
                actual_hours=float(task.actual_hours) if task.actual_hours is not None else None,
            )
            for task in active_tasks
        ],
        completed_task_items=[
            MemberTaskItem(
                id=task.id,
                title=task.title,
                priority=task.priority,
                status=task.status,
                complexity=task.complexity,
                estimated_hours=float(task.estimated_hours) if task.estimated_hours is not None else None,
                actual_hours=float(task.actual_hours) if task.actual_hours is not None else None,
            )
            for task in completed_tasks
        ],
    )