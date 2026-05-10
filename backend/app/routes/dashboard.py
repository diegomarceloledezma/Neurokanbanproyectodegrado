from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Project, ProjectMember, Task, TaskAssignmentHistory, User
from app.routes.auth import get_current_user, has_any_role
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


def _build_member_metrics(
    db: Session,
    *,
    current_user: User,
    accessible_project_ids: Optional[Set[int]] = None,
    only_current_user: bool = False,
) -> List[DashboardTeamMemberMetricItem]:
    memberships_query = (
        db.query(ProjectMember)
        .options(
            joinedload(ProjectMember.user).joinedload(User.global_role),
            joinedload(ProjectMember.user).joinedload(User.project_memberships),
        )
    )

    if accessible_project_ids is not None:
        if not accessible_project_ids:
            return []
        memberships_query = memberships_query.filter(
            ProjectMember.project_id.in_(accessible_project_ids)
        )

    if only_current_user:
        memberships_query = memberships_query.filter(ProjectMember.user_id == current_user.id)

    memberships = memberships_query.all()

    unique_users: Dict[int, User] = {}
    for membership in memberships:
        if membership.user and membership.user.id not in unique_users:
            unique_users[membership.user.id] = membership.user

    if only_current_user and current_user.id not in unique_users:
        user = (
            db.query(User)
            .options(
                joinedload(User.global_role),
                joinedload(User.project_memberships),
            )
            .filter(User.id == current_user.id)
            .first()
        )
        if user:
            unique_users[user.id] = user

    if not unique_users:
        return []

    member_ids = list(unique_users.keys())

    assigned_tasks_query = db.query(Task).filter(Task.assigned_to.in_(member_ids))

    if accessible_project_ids is not None and accessible_project_ids:
        assigned_tasks_query = assigned_tasks_query.filter(Task.project_id.in_(accessible_project_ids))

    assigned_tasks = assigned_tasks_query.order_by(Task.id.asc()).all()

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

        relevant_memberships = user.project_memberships or []
        if accessible_project_ids is not None:
            relevant_memberships = [
                item for item in relevant_memberships if item.project_id in accessible_project_ids
            ]

        latest_membership = None
        if relevant_memberships:
            latest_membership = sorted(
                relevant_memberships,
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
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    accessible_project_ids = _get_accessible_project_ids(db, current_user)
    today = date.today()

    projects_query = (
        db.query(Project)
        .options(joinedload(Project.members))
        .order_by(Project.id.desc())
    )

    tasks_query = db.query(Task).order_by(Task.id.asc())

    if has_any_role(current_user, "admin"):
        member_metrics = _build_member_metrics(db, current_user=current_user)
    elif has_any_role(current_user, "leader"):
        if accessible_project_ids:
            projects_query = projects_query.filter(Project.id.in_(accessible_project_ids))
            tasks_query = tasks_query.filter(Task.project_id.in_(accessible_project_ids))
        else:
            projects_query = projects_query.filter(False)
            tasks_query = tasks_query.filter(False)

        member_metrics = _build_member_metrics(
            db,
            current_user=current_user,
            accessible_project_ids=accessible_project_ids,
        )
    else:
        if accessible_project_ids:
            projects_query = projects_query.filter(Project.id.in_(accessible_project_ids))
        else:
            projects_query = projects_query.filter(False)

        tasks_query = tasks_query.filter(Task.assigned_to == current_user.id)

        member_metrics = _build_member_metrics(
            db,
            current_user=current_user,
            accessible_project_ids=accessible_project_ids,
            only_current_user=True,
        )

    projects = projects_query.all()
    tasks = tasks_query.all()

    pending_tasks = sum(1 for task in tasks if task.status == "pending")
    in_progress_tasks = sum(1 for task in tasks if task.status == "in_progress")
    completed_tasks = sum(1 for task in tasks if task.status == "done")
    overdue_tasks = sum(
        1
        for task in tasks
        if task.due_date is not None and task.due_date < today and task.status != "done"
    )

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

    history_query = (
        db.query(TaskAssignmentHistory)
        .options(
            joinedload(TaskAssignmentHistory.task),
            joinedload(TaskAssignmentHistory.assigned_user),
        )
        .order_by(TaskAssignmentHistory.created_at.desc())
    )

    if has_any_role(current_user, "leader"):
        if accessible_project_ids:
            history_query = history_query.join(TaskAssignmentHistory.task).filter(
                Task.project_id.in_(accessible_project_ids)
            )
        else:
            history_query = history_query.filter(False)
    elif has_any_role(current_user, "member"):
        history_query = history_query.join(TaskAssignmentHistory.task).filter(
            Task.assigned_to == current_user.id
        )

    history = history_query.all()

    recent_recommendations: List[DashboardRecommendationItem] = []
    for item in history:
        if not item.task or not item.assigned_user:
            continue

        if item.source not in {"recommended", "hybrid", "heuristic"}:
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
def get_team_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver métricas de equipo",
        )

    accessible_project_ids = _get_accessible_project_ids(db, current_user)

    tasks_query = db.query(Task).order_by(Task.id.asc())

    if has_any_role(current_user, "leader"):
        if accessible_project_ids:
            tasks_query = tasks_query.filter(Task.project_id.in_(accessible_project_ids))
        else:
            tasks_query = tasks_query.filter(False)

        member_metrics = _build_member_metrics(
            db,
            current_user=current_user,
            accessible_project_ids=accessible_project_ids,
        )
    else:
        member_metrics = _build_member_metrics(db, current_user=current_user)

    tasks = tasks_query.all()
    today = date.today()

    completed_tasks = sum(1 for task in tasks if task.status == "done")
    delayed_tasks = sum(
        1
        for task in tasks
        if task.due_date is not None and task.due_date < today and task.status != "done"
    )

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