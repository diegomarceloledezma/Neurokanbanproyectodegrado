from fastapi import APIRouter, Depends, Query
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
)
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


@router.get("/report")
def get_data_provenance_report(db: Session = Depends(get_db)):
    total_projects = int(db.query(func.count(Project.id)).scalar() or 0)
    active_projects = int(
        db.query(func.count(Project.id)).filter(Project.status == "active").scalar() or 0
    )

    total_tasks = int(db.query(func.count(Task.id)).scalar() or 0)
    tasks_with_required_skills = int(
        db.query(func.count(func.distinct(TaskRequiredSkill.task_id))).scalar() or 0
    )
    tasks_with_assignee = int(
        db.query(func.count(Task.id)).filter(Task.assigned_to.isnot(None)).scalar() or 0
    )

    total_project_memberships = int(db.query(func.count(ProjectMember.id)).scalar() or 0)

    total_skills = int(db.query(func.count(Skill.id)).scalar() or 0)
    skills_with_source = int(
        db.query(func.count(Skill.id)).filter(Skill.source_name.isnot(None)).scalar() or 0
    )
    skills_without_source = max(0, total_skills - skills_with_source)

    total_aliases = int(db.query(func.count(SkillAlias.id)).scalar() or 0)

    total_recommendations = int(db.query(func.count(Recommendation.id)).scalar() or 0)

    total_assignment_history = int(
        db.query(func.count(TaskAssignmentHistory.id)).scalar() or 0
    )

    assignment_records_with_outcome = int(
        db.query(func.count(TaskAssignmentHistory.id))
        .join(TaskOutcome, TaskOutcome.task_id == TaskAssignmentHistory.task_id)
        .scalar()
        or 0
    )

    assignment_records_without_outcome = max(
        0, total_assignment_history - assignment_records_with_outcome
    )

    total_task_outcomes = int(db.query(func.count(TaskOutcome.id)).scalar() or 0)

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

    tasks_by_type = _grouped_count(
        db.query(Task.task_type, func.count(Task.id))
        .group_by(Task.task_type)
        .order_by(func.count(Task.id).desc())
        .all()
    )

    tasks_by_priority = _grouped_count(
        db.query(Task.priority, func.count(Task.id))
        .group_by(Task.priority)
        .order_by(func.count(Task.id).desc())
        .all()
    )

    tasks_by_status = _grouped_count(
        db.query(Task.status, func.count(Task.id))
        .group_by(Task.status)
        .order_by(func.count(Task.id).desc())
        .all()
    )

    assignments_by_source = _grouped_count(
        db.query(TaskAssignmentHistory.source, func.count(TaskAssignmentHistory.id))
        .group_by(TaskAssignmentHistory.source)
        .order_by(func.count(TaskAssignmentHistory.id).desc())
        .all()
    )

    assignments_by_strategy = _grouped_count(
        db.query(
            func.coalesce(TaskAssignmentHistory.strategy, "NO_DEFINIDO"),
            func.count(TaskAssignmentHistory.id),
        )
        .group_by(func.coalesce(TaskAssignmentHistory.strategy, "NO_DEFINIDO"))
        .order_by(func.count(TaskAssignmentHistory.id).desc())
        .all()
    )

    recommendations_by_strategy = _grouped_count(
        db.query(
            func.coalesce(Recommendation.strategy, "NO_DEFINIDO"),
            func.count(Recommendation.id),
        )
        .group_by(func.coalesce(Recommendation.strategy, "NO_DEFINIDO"))
        .order_by(func.count(Recommendation.id).desc())
        .all()
    )

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
def get_training_readiness(db: Session = Depends(get_db)):
    total_skills = int(db.query(func.count(Skill.id)).scalar() or 0)
    skills_with_source = int(
        db.query(func.count(Skill.id)).filter(Skill.source_name.isnot(None)).scalar() or 0
    )

    total_tasks = int(db.query(func.count(Task.id)).scalar() or 0)
    tasks_with_required_skills = int(
        db.query(func.count(func.distinct(TaskRequiredSkill.task_id))).scalar() or 0
    )

    total_assignment_history = int(
        db.query(func.count(TaskAssignmentHistory.id)).scalar() or 0
    )
    assignment_records_with_outcome = int(
        db.query(func.count(TaskAssignmentHistory.id))
        .join(TaskOutcome, TaskOutcome.task_id == TaskAssignmentHistory.task_id)
        .scalar()
        or 0
    )

    total_recommendations = int(db.query(func.count(Recommendation.id)).scalar() or 0)
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
):
    return backfill_assignment_history_from_existing_tasks(db, limit=limit)