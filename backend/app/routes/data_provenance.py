from typing import Set

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    Project,
    ProjectMember,
    Recommendation,
    Skill,
    SkillAlias,
    Task,
    TaskAssignmentHistory,
    TaskOutcome,
    TaskRequiredSkill,
    User,
)
from app.routes.auth import get_current_user, has_any_role
from app.services.historical_backfill_service import (
    backfill_assignment_history_from_existing_tasks,
)

router = APIRouter(prefix="/data-provenance", tags=["Data Provenance"])


def _grouped_count(rows):
    return [
        {
            "label": label if label not in (None, "") else "NO_DEFINIDO",
            "count": int(count or 0),
        }
        for label, count in rows
    ]


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


@router.get("/report")
def get_data_provenance_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver el reporte de trazabilidad",
        )

    accessible_project_ids = _get_accessible_project_ids(db, current_user)
    is_admin = has_any_role(current_user, "admin")

    projects_query = db.query(Project)
    tasks_query = db.query(Task)
    project_memberships_query = db.query(ProjectMember)
    assignment_history_query = db.query(TaskAssignmentHistory).join(
        Task, Task.id == TaskAssignmentHistory.task_id
    )
    task_outcomes_query = db.query(TaskOutcome).join(Task, Task.id == TaskOutcome.task_id)
    recommendations_query = db.query(Recommendation).join(Task, Task.id == Recommendation.task_id)
    task_required_skills_query = db.query(TaskRequiredSkill).join(Task, Task.id == TaskRequiredSkill.task_id)

    if not is_admin:
        if accessible_project_ids:
            projects_query = projects_query.filter(Project.id.in_(accessible_project_ids))
            tasks_query = tasks_query.filter(Task.project_id.in_(accessible_project_ids))
            project_memberships_query = project_memberships_query.filter(
                ProjectMember.project_id.in_(accessible_project_ids)
            )
            assignment_history_query = assignment_history_query.filter(
                Task.project_id.in_(accessible_project_ids)
            )
            task_outcomes_query = task_outcomes_query.filter(Task.project_id.in_(accessible_project_ids))
            recommendations_query = recommendations_query.filter(Task.project_id.in_(accessible_project_ids))
            task_required_skills_query = task_required_skills_query.filter(
                Task.project_id.in_(accessible_project_ids)
            )
        else:
            projects_query = projects_query.filter(False)
            tasks_query = tasks_query.filter(False)
            project_memberships_query = project_memberships_query.filter(False)
            assignment_history_query = assignment_history_query.filter(False)
            task_outcomes_query = task_outcomes_query.filter(False)
            recommendations_query = recommendations_query.filter(False)
            task_required_skills_query = task_required_skills_query.filter(False)

    total_projects = int(projects_query.with_entities(func.count(Project.id)).scalar() or 0)
    active_projects = int(
        projects_query.filter(Project.status == "active")
        .with_entities(func.count(Project.id))
        .scalar()
        or 0
    )

    total_tasks = int(tasks_query.with_entities(func.count(Task.id)).scalar() or 0)
    tasks_with_required_skills = int(
        task_required_skills_query.with_entities(func.count(func.distinct(TaskRequiredSkill.task_id))).scalar() or 0
    )
    tasks_with_assignee = int(
        tasks_query.filter(Task.assigned_to.isnot(None)).with_entities(func.count(Task.id)).scalar() or 0
    )

    total_project_memberships = int(
        project_memberships_query.with_entities(func.count(ProjectMember.id)).scalar() or 0
    )

    total_skills = int(db.query(func.count(Skill.id)).scalar() or 0)
    skills_with_source = int(
        db.query(func.count(Skill.id)).filter(Skill.source_name.isnot(None)).scalar() or 0
    )
    skills_without_source = max(0, total_skills - skills_with_source)

    total_aliases = int(db.query(func.count(SkillAlias.id)).scalar() or 0)

    total_recommendations = int(
        recommendations_query.with_entities(func.count(Recommendation.id)).scalar() or 0
    )

    total_assignment_history = int(
        assignment_history_query.with_entities(func.count(TaskAssignmentHistory.id)).scalar() or 0
    )

    assignment_records_with_outcome = int(
        db.query(func.count(TaskAssignmentHistory.id))
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
        .join(TaskOutcome, TaskOutcome.task_id == TaskAssignmentHistory.task_id)
        .filter(Task.project_id.in_(accessible_project_ids) if (not is_admin and accessible_project_ids) else True)
        .scalar()
        or 0
    ) if is_admin or accessible_project_ids else 0

    assignment_records_without_outcome = max(
        0, total_assignment_history - assignment_records_with_outcome
    )

    total_task_outcomes = int(
        task_outcomes_query.with_entities(func.count(TaskOutcome.id)).scalar() or 0
    )

    skills_by_source = _grouped_count(
        db.query(
            func.coalesce(Skill.source_name, "NO_DEFINIDO"),
            func.count(Skill.id),
        )
        .group_by(func.coalesce(Skill.source_name, "NO_DEFINIDO"))
        .order_by(func.count(Skill.id).desc())
        .all()
    )

    skills_by_category = _grouped_count(
        db.query(
            func.coalesce(Skill.category, "NO_DEFINIDO"),
            func.count(Skill.id),
        )
        .group_by(func.coalesce(Skill.category, "NO_DEFINIDO"))
        .order_by(func.count(Skill.id).desc())
        .all()
    )

    aliases_by_source = _grouped_count(
        db.query(
            func.coalesce(SkillAlias.source_name, "NO_DEFINIDO"),
            func.count(SkillAlias.id),
        )
        .group_by(func.coalesce(SkillAlias.source_name, "NO_DEFINIDO"))
        .order_by(func.count(SkillAlias.id).desc())
        .all()
    )

    tasks_by_type_query = (
        db.query(Task.task_type, func.count(Task.id))
        .group_by(Task.task_type)
        .order_by(func.count(Task.id).desc())
    )
    tasks_by_priority_query = (
        db.query(Task.priority, func.count(Task.id))
        .group_by(Task.priority)
        .order_by(func.count(Task.id).desc())
    )
    tasks_by_status_query = (
        db.query(Task.status, func.count(Task.id))
        .group_by(Task.status)
        .order_by(func.count(Task.id).desc())
    )
    assignments_by_source_query = (
        db.query(TaskAssignmentHistory.source, func.count(TaskAssignmentHistory.id))
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
        .group_by(TaskAssignmentHistory.source)
        .order_by(func.count(TaskAssignmentHistory.id).desc())
    )
    assignments_by_strategy_query = (
        db.query(
            func.coalesce(TaskAssignmentHistory.strategy, "NO_DEFINIDO"),
            func.count(TaskAssignmentHistory.id),
        )
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
        .group_by(func.coalesce(TaskAssignmentHistory.strategy, "NO_DEFINIDO"))
        .order_by(func.count(TaskAssignmentHistory.id).desc())
    )
    recommendations_by_strategy_query = (
        db.query(
            func.coalesce(Recommendation.strategy, "NO_DEFINIDO"),
            func.count(Recommendation.id),
        )
        .join(Task, Task.id == Recommendation.task_id)
        .group_by(func.coalesce(Recommendation.strategy, "NO_DEFINIDO"))
        .order_by(func.count(Recommendation.id).desc())
    )

    if not is_admin:
        if accessible_project_ids:
            tasks_by_type_query = tasks_by_type_query.filter(Task.project_id.in_(accessible_project_ids))
            tasks_by_priority_query = tasks_by_priority_query.filter(Task.project_id.in_(accessible_project_ids))
            tasks_by_status_query = tasks_by_status_query.filter(Task.project_id.in_(accessible_project_ids))
            assignments_by_source_query = assignments_by_source_query.filter(Task.project_id.in_(accessible_project_ids))
            assignments_by_strategy_query = assignments_by_strategy_query.filter(Task.project_id.in_(accessible_project_ids))
            recommendations_by_strategy_query = recommendations_by_strategy_query.filter(Task.project_id.in_(accessible_project_ids))
        else:
            tasks_by_type_query = tasks_by_type_query.filter(False)
            tasks_by_priority_query = tasks_by_priority_query.filter(False)
            tasks_by_status_query = tasks_by_status_query.filter(False)
            assignments_by_source_query = assignments_by_source_query.filter(False)
            assignments_by_strategy_query = assignments_by_strategy_query.filter(False)
            recommendations_by_strategy_query = recommendations_by_strategy_query.filter(False)

    tasks_by_type = _grouped_count(tasks_by_type_query.all())
    tasks_by_priority = _grouped_count(tasks_by_priority_query.all())
    tasks_by_status = _grouped_count(tasks_by_status_query.all())
    assignments_by_source = _grouped_count(assignments_by_source_query.all())
    assignments_by_strategy = _grouped_count(assignments_by_strategy_query.all())
    recommendations_by_strategy = _grouped_count(recommendations_by_strategy_query.all())

    return {
        "projects": {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "total_project_memberships": total_project_memberships,
        },
        "tasks": {
            "total_tasks": total_tasks,
            "tasks_with_required_skills": tasks_with_required_skills,
            "tasks_with_assignee": tasks_with_assignee,
            "tasks_by_type": tasks_by_type,
            "tasks_by_priority": tasks_by_priority,
            "tasks_by_status": tasks_by_status,
        },
        "skills_catalog": {
            "total_skills": total_skills,
            "skills_with_source": skills_with_source,
            "skills_without_source": skills_without_source,
            "skills_by_source": skills_by_source,
            "skills_by_category": skills_by_category,
            "total_aliases": total_aliases,
            "aliases_by_source": aliases_by_source,
        },
        "recommendation_flow": {
            "total_recommendations": total_recommendations,
            "total_assignment_history": total_assignment_history,
            "assignments_by_source": assignments_by_source,
            "assignments_by_strategy": assignments_by_strategy,
            "recommendations_by_strategy": recommendations_by_strategy,
        },
        "training_base": {
            "total_task_outcomes": total_task_outcomes,
            "assignment_records_with_outcome": assignment_records_with_outcome,
            "assignment_records_without_outcome": assignment_records_without_outcome,
        },
    }


@router.get("/training-readiness")
def get_training_readiness(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver el readiness del entrenamiento",
        )

    accessible_project_ids = _get_accessible_project_ids(db, current_user)
    is_admin = has_any_role(current_user, "admin")

    total_skills = int(db.query(func.count(Skill.id)).scalar() or 0)
    skills_with_source = int(
        db.query(func.count(Skill.id)).filter(Skill.source_name.isnot(None)).scalar() or 0
    )

    tasks_query = db.query(Task)
    task_required_skills_query = db.query(TaskRequiredSkill).join(Task, Task.id == TaskRequiredSkill.task_id)
    assignment_history_query = db.query(TaskAssignmentHistory).join(Task, Task.id == TaskAssignmentHistory.task_id)
    recommendations_query = db.query(Recommendation).join(Task, Task.id == Recommendation.task_id)

    if not is_admin:
        if accessible_project_ids:
            tasks_query = tasks_query.filter(Task.project_id.in_(accessible_project_ids))
            task_required_skills_query = task_required_skills_query.filter(Task.project_id.in_(accessible_project_ids))
            assignment_history_query = assignment_history_query.filter(Task.project_id.in_(accessible_project_ids))
            recommendations_query = recommendations_query.filter(Task.project_id.in_(accessible_project_ids))
        else:
            tasks_query = tasks_query.filter(False)
            task_required_skills_query = task_required_skills_query.filter(False)
            assignment_history_query = assignment_history_query.filter(False)
            recommendations_query = recommendations_query.filter(False)

    total_tasks = int(tasks_query.with_entities(func.count(Task.id)).scalar() or 0)
    tasks_with_required_skills = int(
        task_required_skills_query.with_entities(func.count(func.distinct(TaskRequiredSkill.task_id))).scalar() or 0
    )

    total_assignment_history = int(
        assignment_history_query.with_entities(func.count(TaskAssignmentHistory.id)).scalar() or 0
    )
    assignment_records_with_outcome = int(
        db.query(func.count(TaskAssignmentHistory.id))
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
        .join(TaskOutcome, TaskOutcome.task_id == TaskAssignmentHistory.task_id)
        .filter(Task.project_id.in_(accessible_project_ids) if (not is_admin and accessible_project_ids) else True)
        .scalar()
        or 0
    ) if is_admin or accessible_project_ids else 0

    total_recommendations = int(
        recommendations_query.with_entities(func.count(Recommendation.id)).scalar() or 0
    )
    total_aliases = int(db.query(func.count(SkillAlias.id)).scalar() or 0)

    skills_source_coverage = round(
        (skills_with_source / total_skills) * 100, 2
    ) if total_skills > 0 else 0.0

    task_skill_coverage = round(
        (tasks_with_required_skills / total_tasks) * 100, 2
    ) if total_tasks > 0 else 0.0

    outcome_linked_assignment_coverage = round(
        (assignment_records_with_outcome / total_assignment_history) * 100, 2
    ) if total_assignment_history > 0 else 0.0

    readiness_score = round(
        (skills_source_coverage * 0.35)
        + (task_skill_coverage * 0.30)
        + (outcome_linked_assignment_coverage * 0.35),
        2,
    )

    if readiness_score >= 75:
        readiness_level = "alta"
    elif readiness_score >= 50:
        readiness_level = "media"
    else:
        readiness_level = "baja"

    observations = []

    if skills_source_coverage < 80:
        observations.append("Conviene ampliar la cobertura de fuente del catálogo de habilidades.")

    if task_skill_coverage < 70:
        observations.append("Conviene registrar habilidades requeridas en una mayor proporción de tareas.")

    if outcome_linked_assignment_coverage < 60:
        observations.append("Conviene registrar más resultados finales de tareas para fortalecer el entrenamiento.")

    if total_aliases < 20:
        observations.append("Conviene ampliar el catálogo de aliases para mejorar el matching semántico.")

    if total_recommendations == 0:
        observations.append("Conviene generar más recomendaciones registradas para enriquecer el histórico.")

    return {
        "readiness_score": readiness_score,
        "readiness_level": readiness_level,
        "coverage": {
            "skills_source_coverage": skills_source_coverage,
            "task_skill_coverage": task_skill_coverage,
            "outcome_linked_assignment_coverage": outcome_linked_assignment_coverage,
        },
        "counts": {
            "total_skills": total_skills,
            "skills_with_source": skills_with_source,
            "total_tasks": total_tasks,
            "tasks_with_required_skills": tasks_with_required_skills,
            "total_assignment_history": total_assignment_history,
            "assignment_records_with_outcome": assignment_records_with_outcome,
            "total_recommendations": total_recommendations,
            "total_aliases": total_aliases,
        },
        "observations": observations,
    }


@router.post("/backfill-assignment-history")
def run_assignment_history_backfill(
    limit: int = Query(default=200, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin"):
        raise HTTPException(
            status_code=403,
            detail="Solo un administrador puede ejecutar el backfill del historial",
        )

    return backfill_assignment_history_from_existing_tasks(db, limit=limit)