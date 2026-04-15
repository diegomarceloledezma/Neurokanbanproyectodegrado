from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import ProjectMember, Task, User, UserSkill
from app.schemas import MemberProfileResponse, MemberSkillItem, MemberTaskItem

router = APIRouter(prefix="/members", tags=["Members"])

ACTIVE_STATUSES = {"pending", "in_progress", "review", "blocked"}
COMPLETED_STATUSES = {"done"}


@router.get("/{member_id}/profile", response_model=MemberProfileResponse)
def get_member_profile(member_id: int, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(
            joinedload(User.global_role),
            joinedload(User.user_skills).joinedload(UserSkill.skill),
            joinedload(User.project_memberships),
        )
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

    active_tasks = [task for task in assigned_tasks if task.status in ACTIVE_STATUSES]
    completed_tasks = [task for task in assigned_tasks if task.status in COMPLETED_STATUSES]

    total_tasks = len(assigned_tasks)
    active_count = len(active_tasks)
    completed_count = len(completed_tasks)

    completion_rate = round((completed_count / total_tasks) * 100, 2) if total_tasks > 0 else 0.0

    total_active_hours = sum(float(task.estimated_hours) for task in active_tasks if task.estimated_hours is not None)

    latest_membership = None
    if user.project_memberships:
        latest_membership = sorted(
            user.project_memberships,
            key=lambda item: item.joined_at,
            reverse=True,
        )[0]

    capacity_hours = float(latest_membership.weekly_capacity_hours) if latest_membership and latest_membership.weekly_capacity_hours is not None else 40.0
    declared_availability = float(latest_membership.availability_percentage) if latest_membership and latest_membership.availability_percentage is not None else 100.0

    current_load = round(min((total_active_hours / capacity_hours) * 100, 100), 2) if capacity_hours > 0 else 0.0
    availability = round(min(declared_availability, max(100 - current_load, 0)), 2)

    avg_experience = 0.0
    if user.user_skills:
        avg_experience = round(
            sum(float(item.years_experience or 0) for item in user.user_skills) / len(user.user_skills),
            2,
        )

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
        project_capacity_hours=capacity_hours,
        experience_level=avg_experience,
        skills=[
            MemberSkillItem(
                skill_name=item.skill.name if item.skill else f"skill_{item.skill_id}",
                category=item.skill.category if item.skill else None,
                level=item.level,
                years_experience=float(item.years_experience or 0),
                verified_by_leader=item.verified_by_leader,
            )
            for item in user.user_skills
        ],
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