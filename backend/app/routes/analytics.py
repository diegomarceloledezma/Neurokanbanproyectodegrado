from __future__ import annotations

from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Task, TaskAssignmentHistory, TaskOutcome, User, UserSkill
from app.services.synthetic_history_generator import (
    compute_success_label,
    compute_success_score,
    generate_synthetic_history,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _to_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _build_training_row(decision: TaskAssignmentHistory):
    task = decision.task
    outcome = task.outcome if task else None
    if not task or not outcome:
        return None

    success_score = compute_success_score(
        finished_on_time=bool(outcome.finished_on_time),
        delay_hours=_to_float(outcome.delay_hours),
        quality_score=int(outcome.quality_score or 0),
        had_rework=bool(outcome.had_rework),
    )
    success_label = compute_success_label(success_score)

    return {
        "assignment_decision_id": decision.id,
        "task_id": task.id,
        "project_id": task.project_id,
        "assigned_to": decision.assigned_to,
        "source": decision.source,
        "strategy": decision.strategy,
        "recommendation_used": bool(decision.recommendation_used),
        "recommendation_score": _to_float(decision.recommendation_score, None),
        "workload_score": _to_float(decision.workload_score, None),
        "skill_match_score": _to_float(decision.skill_match_score, None),
        "availability_score": _to_float(decision.availability_score, None),
        "performance_score": _to_float(decision.performance_score, None),
        "current_load_snapshot": _to_float(decision.current_load_snapshot, None),
        "availability_snapshot": _to_float(decision.availability_snapshot, None),
        "active_tasks_snapshot": decision.active_tasks_snapshot,
        "required_skills_count": decision.required_skills_count,
        "matching_skills_count": decision.matching_skills_count,
        "matching_ratio": _to_float(decision.matching_ratio, None),
        "estimated_hours_snapshot": _to_float(decision.estimated_hours_snapshot, None),
        "priority_snapshot": decision.priority_snapshot,
        "complexity_snapshot": decision.complexity_snapshot,
        "finished_on_time": bool(outcome.finished_on_time),
        "delay_hours": _to_float(outcome.delay_hours),
        "quality_score": int(outcome.quality_score or 0),
        "had_rework": bool(outcome.had_rework),
        "success_score": success_score,
        "success_label": success_label,
    }


def _fetch_decisions(db: Session, project_id: Optional[int] = None):
    query = (
        db.query(TaskAssignmentHistory)
        .options(
            joinedload(TaskAssignmentHistory.task).joinedload(Task.outcome),
        )
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
        .order_by(TaskAssignmentHistory.id.asc())
    )
    if project_id is not None:
        query = query.filter(Task.project_id == project_id)
    return query.all()


@router.get("/training-dataset")
def get_training_dataset(
    project_id: Optional[int] = Query(default=None),
    limit: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    decisions = _fetch_decisions(db, project_id)
    rows = []
    for decision in decisions:
        row = _build_training_row(decision)
        if row:
            rows.append(row)

    rows.sort(key=lambda item: item["assignment_decision_id"], reverse=True)
    if limit is not None:
        rows = rows[:limit]
    return rows


@router.get("/training-dataset-summary")
def get_training_dataset_summary(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    decisions = _fetch_decisions(db, project_id)
    rows = []
    for decision in decisions:
        row = _build_training_row(decision)
        if row:
            rows.append(row)

    if not rows:
        return {
            "project_id": project_id,
            "total_rows": 0,
            "success_rate": 0,
            "label_distribution": {"success": 0, "failure_or_risk": 0},
            "source_distribution": {},
            "strategy_distribution": {},
            "priority_distribution": {},
            "feature_averages": {},
        }

    success_count = sum(1 for row in rows if row["success_label"] == 1)
    failure_count = len(rows) - success_count

    source_distribution = dict(Counter(row["source"] for row in rows))
    strategy_distribution = dict(Counter(row["strategy"] for row in rows if row["strategy"]))
    priority_distribution = dict(Counter(row["priority_snapshot"] for row in rows if row["priority_snapshot"]))

    numeric_fields = [
        "recommendation_score",
        "workload_score",
        "skill_match_score",
        "availability_score",
        "performance_score",
        "current_load_snapshot",
        "availability_snapshot",
        "matching_ratio",
        "estimated_hours_snapshot",
        "quality_score",
        "delay_hours",
        "success_score",
    ]

    feature_averages = {}
    for field in numeric_fields:
        values = [row[field] for row in rows if row[field] is not None]
        if values:
            feature_averages[field] = round(sum(values) / len(values), 2)

    return {
        "project_id": project_id,
        "total_rows": len(rows),
        "success_rate": round((success_count / len(rows)) * 100, 2),
        "label_distribution": {
            "success": success_count,
            "failure_or_risk": failure_count,
        },
        "source_distribution": source_distribution,
        "strategy_distribution": strategy_distribution,
        "priority_distribution": priority_distribution,
        "feature_averages": feature_averages,
    }


@router.post("/generate-synthetic-history")
def generate_synthetic_history_endpoint(
    source_project_id: int = Query(..., ge=1),
    records_count: int = Query(default=120, ge=20, le=1000),
    seed: int = Query(default=42),
    create_dataset_project: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    try:
        result = generate_synthetic_history(
            db,
            source_project_id=source_project_id,
            records_count=records_count,
            seed=seed,
            create_dataset_project=create_dataset_project,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "message": "Histórico sintético calibrado generado correctamente",
        "source_project_id": result.source_project_id,
        "target_project_id": result.target_project_id,
        "target_project_name": result.target_project_name,
        "created_dataset_project": result.created_dataset_project,
        "background_tasks_created": result.background_tasks_created,
        "synthetic_tasks_created": result.synthetic_tasks_created,
        "assignment_decisions_created": result.assignment_decisions_created,
        "outcomes_created": result.outcomes_created,
        "sample_task_ids": result.sample_task_ids,
        "label_distribution": result.label_distribution,
        "source_distribution": result.source_distribution,
        "strategy_distribution": result.strategy_distribution,
        "task_type_distribution": result.task_type_distribution,
        "seed": result.seed,
    }


@router.post("/backfill-assignment-snapshots")
def backfill_assignment_snapshots(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    decisions = (
        db.query(TaskAssignmentHistory)
        .options(
            joinedload(TaskAssignmentHistory.task).joinedload(Task.required_skills),
            joinedload(TaskAssignmentHistory.assigned_user).joinedload(User.user_skills).joinedload(UserSkill.skill),
        )
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
    )

    if project_id is not None:
        decisions = decisions.filter(Task.project_id == project_id)

    rows = decisions.all()
    updated = 0

    for decision in rows:
        task = decision.task
        user = decision.assigned_user
        if not task or not user:
            continue

        member_skill_ids = {item.skill_id for item in user.user_skills or []}
        required_skill_ids = {item.skill_id for item in task.required_skills or []}
        required_count = len(required_skill_ids)
        matching_count = len(required_skill_ids & member_skill_ids)
        matching_ratio = round((matching_count / required_count) * 100, 2) if required_count else 0.0

        changed = False

        if decision.required_skills_count is None:
            decision.required_skills_count = required_count
            changed = True
        if decision.matching_skills_count is None:
            decision.matching_skills_count = matching_count
            changed = True
        if decision.matching_ratio is None:
            decision.matching_ratio = matching_ratio
            changed = True
        if decision.estimated_hours_snapshot is None and task.estimated_hours is not None:
            decision.estimated_hours_snapshot = task.estimated_hours
            changed = True
        if decision.priority_snapshot is None:
            decision.priority_snapshot = task.priority
            changed = True
        if decision.complexity_snapshot is None:
            decision.complexity_snapshot = task.complexity
            changed = True
        if decision.skill_match_score is None:
            decision.skill_match_score = matching_ratio
            changed = True
        if decision.current_load_snapshot is None:
            decision.current_load_snapshot = 60.0
            changed = True
        if decision.availability_snapshot is None:
            decision.availability_snapshot = max(0.0, 100.0 - float(decision.current_load_snapshot or 60.0))
            changed = True
        if decision.active_tasks_snapshot is None:
            decision.active_tasks_snapshot = 2
            changed = True
        if decision.workload_score is None:
            decision.workload_score = round(max(0.0, 100.0 - float(decision.current_load_snapshot or 60.0)), 2)
            changed = True
        if decision.availability_score is None:
            decision.availability_score = round(float(decision.availability_snapshot or 0.0), 2)
            changed = True
        if decision.performance_score is None:
            decision.performance_score = 55.0
            changed = True

        if changed:
            updated += 1

    db.commit()
    return {
        "message": "Snapshots recalculados correctamente",
        "updated_records": updated,
        "project_id": project_id,
    }