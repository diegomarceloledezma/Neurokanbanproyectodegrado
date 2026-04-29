from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Project, ProjectMember, Task, TaskAssignmentHistory, User
from app.schemas import (
    DashboardOverviewResponse,
    DashboardProjectItem,
    DashboardRecommendationItem,
    DashboardStatusDistributionItem,
    DashboardTeamMemberMetricItem,
    DashboardTeamMetricsResponse,
    DashboardValuePoint,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

ACTIVE_STATUSES = {"pending", "in_progress", "review", "blocked"}
DONE_STATUSES = {"done"}

STATUS_LABELS: Dict[str, str] = {
    "pending": "Pendientes",
    "in_progress": "En progreso",
    "review": "En revisión",
    "done": "Completadas",
    "blocked": "Bloqueadas",
}


def _to_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _build_member_metrics(db: Session) -> List[DashboardTeamMemberMetricItem]:
    memberships = (
        db.query(ProjectMember)
        .options(
            joinedload(ProjectMember.user)
            .joinedload(User.global_role),
            joinedload(ProjectMember.user)
            .joinedload(User.project_memberships),
        )
        .all()
    )

    unique_users: Dict[int, User] = {}
    for membership in memberships:
        if membership.user and membership.user.id not in unique_users:
            unique_users[membership.user.id] = membership.user

    if not unique_users:
        return []

    member_ids = list(unique_users.keys())

    assigned_tasks = (
        db.query(Task)
        .filter(Task.assigned_to.in_(member_ids))
        .order_by(Task.id.asc())
        .all()
    )

    tasks_by_user: Dict[int, List[Task]] = defaultdict(list)
    for task in assigned_tasks:
        if task.assigned_to is not None:
            tasks_by_user[int(task.assigned_to)].append(task)

    result: List[DashboardTeamMemberMetricItem] = []

    for user_id, user in unique_users.items():
        user_tasks = tasks_by_user.get(user_id, [])
        active_tasks = [task for task in user_tasks if task.status in ACTIVE_STATUSES]
        completed_tasks = [task for task in user_tasks if task.status in DONE_STATUSES]

        total_tasks = len(user_tasks)
        active_count = len(active_tasks)
        completed_count = len(completed_tasks)

        completion_rate = round((completed_count / total_tasks) * 100, 2) if total_tasks > 0 else 0.0

        latest_membership = None
        if user.project_memberships:
            latest_membership = sorted(
                user.project_memberships,
                key=lambda item: item.joined_at,
                reverse=True,
            )[0]

        capacity_hours = (
            _to_float(latest_membership.weekly_capacity_hours, 40.0)
            if latest_membership
            else 40.0
        )

        total_active_hours = sum(_to_float(task.estimated_hours) for task in active_tasks)
        current_load = round(min((total_active_hours / capacity_hours) * 100, 100), 2) if capacity_hours > 0 else 0.0

        role_name = user.global_role.name if user.global_role else "member"

        result.append(
            DashboardTeamMemberMetricItem(
                id=user.id,
                name=user.full_name,
                role_name=role_name,
                active_tasks=active_count,
                current_load=current_load,
                completion_rate=completion_rate,
            )
        )

    result.sort(key=lambda item: item.name.lower())
    return result


@router.get("/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview(db: Session = Depends(get_db)):
    projects = (
        db.query(Project)
        .options(joinedload(Project.members))
        .order_by(Project.id.desc())
        .all()
    )

    tasks = db.query(Task).order_by(Task.id.asc()).all()
    today = date.today()

    pending_tasks = sum(1 for task in tasks if task.status == "pending")
    in_progress_tasks = sum(1 for task in tasks if task.status == "in_progress")
    completed_tasks = sum(1 for task in tasks if task.status == "done")
    overdue_tasks = sum(
        1
        for task in tasks
        if task.due_date is not None and task.due_date < today and task.status != "done"
    )

    member_metrics = _build_member_metrics(db)
    team_load_average = (
        round(sum(item.current_load for item in member_metrics) / len(member_metrics), 2)
        if member_metrics
        else 0.0
    )
    average_completion_rate = (
        round(sum(item.completion_rate for item in member_metrics) / len(member_metrics), 2)
        if member_metrics
        else 0.0
    )

    recent_projects = [
        DashboardProjectItem(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            members_count=len(project.members or []),
        )
        for project in projects[:5]
    ]

    history = (
        db.query(TaskAssignmentHistory)
        .options(
            joinedload(TaskAssignmentHistory.task),
            joinedload(TaskAssignmentHistory.assigned_user),
        )
        .order_by(TaskAssignmentHistory.created_at.desc())
        .all()
    )

    recent_recommendations: List[DashboardRecommendationItem] = []
    for item in history:
        if not item.task or not item.assigned_user:
            continue

        if item.source not in {"recommended", "hybrid"}:
            continue

        recent_recommendations.append(
            DashboardRecommendationItem(
                id=item.id,
                task_id=item.task_id,
                task_title=item.task.title,
                assigned_user_name=item.assigned_user.full_name,
                recommendation_score=_to_float(item.recommendation_score),
                strategy=item.strategy,
                source=item.source,
                created_at=item.created_at,
            )
        )

        if len(recent_recommendations) >= 5:
            break

    return DashboardOverviewResponse(
        total_projects=len(projects),
        total_tasks=len(tasks),
        pending_tasks=pending_tasks,
        in_progress_tasks=in_progress_tasks,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
        team_load_average=team_load_average,
        average_completion_rate=average_completion_rate,
        recent_projects=recent_projects,
        recent_recommendations=recent_recommendations,
    )


@router.get("/team-metrics", response_model=DashboardTeamMetricsResponse)
def get_team_metrics(db: Session = Depends(get_db)):
    tasks = db.query(Task).order_by(Task.id.asc()).all()
    today = date.today()

    completed_tasks = sum(1 for task in tasks if task.status == "done")
    delayed_tasks = sum(
        1
        for task in tasks
        if task.due_date is not None and task.due_date < today and task.status != "done"
    )

    member_metrics = _build_member_metrics(db)

    average_completion_rate = (
        round(sum(item.completion_rate for item in member_metrics) / len(member_metrics), 2)
        if member_metrics
        else 0.0
    )

    workload_data = [
        DashboardValuePoint(
            id=item.id,
            name=item.name.split(" ")[0],
            primary_value=round(item.current_load, 2),
            secondary_value=item.active_tasks,
        )
        for item in member_metrics
    ]

    performance_data = [
        DashboardValuePoint(
            id=item.id,
            name=item.name.split(" ")[0],
            primary_value=round(item.completion_rate, 2),
            secondary_value=item.active_tasks,
        )
        for item in member_metrics
    ]

    tracked_statuses = ["pending", "in_progress", "review", "done", "blocked"]
    tasks_by_status = [
        DashboardStatusDistributionItem(
            id=status,
            name=STATUS_LABELS.get(status, status),
            value=sum(1 for task in tasks if task.status == status),
        )
        for status in tracked_statuses
    ]

    time_comparison_data = [
        DashboardValuePoint(
            id=task.id,
            name=task.title if len(task.title) <= 22 else f"{task.title[:22]}...",
            primary_value=_to_float(task.estimated_hours),
            secondary_value=_to_float(task.actual_hours),
        )
        for task in tasks
        if task.estimated_hours is not None and task.actual_hours is not None
    ]

    return DashboardTeamMetricsResponse(
        completed_tasks=completed_tasks,
        delayed_tasks=delayed_tasks,
        average_completion_rate=average_completion_rate,
        total_tasks=len(tasks),
        tasks_by_status=tasks_by_status,
        workload_data=workload_data,
        performance_data=performance_data,
        time_comparison_data=time_comparison_data,
        team_members=member_metrics,
    )