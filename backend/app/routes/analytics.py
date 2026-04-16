from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Task, TaskAssignmentHistory
from app.schemas import TrainingDatasetRow
from app.services.recommendation_engine import build_assignment_snapshot_data, load_task_or_none

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _build_success_metrics(outcome):
    on_time_points = 100 if outcome.finished_on_time else 0
    quality_points = (outcome.quality_score or 0) * 20
    rework_points = 0 if outcome.had_rework else 100
    delay_penalty = min(float(outcome.delay_hours or 0) * 5, 100)
    success_score = round(
        max(
            0,
            (on_time_points * 0.35)
            + (quality_points * 0.35)
            + (rework_points * 0.20)
            + ((100 - delay_penalty) * 0.10),
        ),
        2,
    )
    success_label = 1 if success_score >= 70 else 0
    return success_score, success_label


@router.post("/backfill-assignment-snapshots")
def backfill_assignment_snapshots(
    project_id: Optional[int] = Query(default=None),
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    query = (
        db.query(TaskAssignmentHistory)
        .options(joinedload(TaskAssignmentHistory.task))
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
    )

    if project_id is not None:
        query = query.filter(Task.project_id == project_id)

    if not force:
        query = query.filter(
            or_(
                TaskAssignmentHistory.workload_score.is_(None),
                TaskAssignmentHistory.skill_match_score.is_(None),
                TaskAssignmentHistory.availability_score.is_(None),
                TaskAssignmentHistory.performance_score.is_(None),
                TaskAssignmentHistory.current_load_snapshot.is_(None),
                TaskAssignmentHistory.availability_snapshot.is_(None),
                TaskAssignmentHistory.active_tasks_snapshot.is_(None),
                TaskAssignmentHistory.required_skills_count.is_(None),
                TaskAssignmentHistory.matching_skills_count.is_(None),
                TaskAssignmentHistory.estimated_hours_snapshot.is_(None),
                TaskAssignmentHistory.priority_snapshot.is_(None),
                TaskAssignmentHistory.complexity_snapshot.is_(None),
            )
        )

    rows = query.order_by(TaskAssignmentHistory.created_at.asc()).all()

    updated = 0
    skipped = 0
    updated_ids: list[int] = []

    for row in rows:
        task = row.task or load_task_or_none(db, row.task_id)
        if not task:
            skipped += 1
            continue

        snapshot = build_assignment_snapshot_data(
            db=db,
            task=task,
            assigned_user_id=row.assigned_to,
            strategy=row.strategy,
        )

        if not snapshot:
            skipped += 1
            continue

        if force or row.workload_score is None:
            row.workload_score = snapshot["workload_score"]
        if force or row.skill_match_score is None:
            row.skill_match_score = snapshot["skill_match_score"]
        if force or row.availability_score is None:
            row.availability_score = snapshot["availability_score"]
        if force or row.performance_score is None:
            row.performance_score = snapshot["performance_score"]
        if force or row.current_load_snapshot is None:
            row.current_load_snapshot = snapshot["current_load_snapshot"]
        if force or row.availability_snapshot is None:
            row.availability_snapshot = snapshot["availability_snapshot"]
        if force or row.active_tasks_snapshot is None:
            row.active_tasks_snapshot = snapshot["active_tasks_snapshot"]
        if force or row.required_skills_count is None:
            row.required_skills_count = snapshot["required_skills_count"]
        if force or row.matching_skills_count is None:
            row.matching_skills_count = snapshot["matching_skills_count"]
        if force or row.estimated_hours_snapshot is None:
            row.estimated_hours_snapshot = snapshot["estimated_hours_snapshot"]
        if force or row.priority_snapshot is None:
            row.priority_snapshot = snapshot["priority_snapshot"]
        if force or row.complexity_snapshot is None:
            row.complexity_snapshot = snapshot["complexity_snapshot"]
        if (force or row.recommendation_score is None) and snapshot["recommendation_score"] is not None:
            row.recommendation_score = snapshot["recommendation_score"]
        if (force or row.risk_level is None) and snapshot["risk_level"] is not None:
            row.risk_level = snapshot["risk_level"]

        updated += 1
        updated_ids.append(row.id)

    db.commit()

    return {
        "message": "Backfill de snapshots completado",
        "updated_count": updated,
        "skipped_count": skipped,
        "updated_ids": updated_ids,
        "force": force,
        "project_id": project_id,
    }


@router.get("/training-dataset", response_model=List[TrainingDatasetRow])
def get_training_dataset(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(TaskAssignmentHistory)
        .options(joinedload(TaskAssignmentHistory.task).joinedload(Task.outcome))
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
    )

    if project_id is not None:
        query = query.filter(Task.project_id == project_id)

    rows = query.order_by(TaskAssignmentHistory.created_at.desc()).all()

    dataset: list[TrainingDatasetRow] = []

    for row in rows:
        task = row.task
        outcome = task.outcome if task else None

        if not task or not outcome:
            continue

        matching_ratio = None
        if row.required_skills_count and row.required_skills_count > 0 and row.matching_skills_count is not None:
            matching_ratio = round((row.matching_skills_count / row.required_skills_count) * 100, 2)

        success_score, success_label = _build_success_metrics(outcome)

        dataset.append(
            TrainingDatasetRow(
                assignment_decision_id=row.id,
                task_id=row.task_id,
                project_id=task.project_id,
                assigned_to=row.assigned_to,
                source=row.source,
                strategy=row.strategy,
                recommendation_used=row.recommendation_used,
                recommendation_score=float(row.recommendation_score) if row.recommendation_score is not None else None,
                workload_score=float(row.workload_score) if row.workload_score is not None else None,
                skill_match_score=float(row.skill_match_score) if row.skill_match_score is not None else None,
                availability_score=float(row.availability_score) if row.availability_score is not None else None,
                performance_score=float(row.performance_score) if row.performance_score is not None else None,
                current_load_snapshot=float(row.current_load_snapshot) if row.current_load_snapshot is not None else None,
                availability_snapshot=float(row.availability_snapshot) if row.availability_snapshot is not None else None,
                active_tasks_snapshot=row.active_tasks_snapshot,
                required_skills_count=row.required_skills_count,
                matching_skills_count=row.matching_skills_count,
                matching_ratio=matching_ratio,
                estimated_hours_snapshot=float(row.estimated_hours_snapshot) if row.estimated_hours_snapshot is not None else None,
                priority_snapshot=row.priority_snapshot,
                complexity_snapshot=row.complexity_snapshot,
                finished_on_time=outcome.finished_on_time,
                delay_hours=float(outcome.delay_hours or 0),
                quality_score=outcome.quality_score,
                had_rework=outcome.had_rework,
                success_score=success_score,
                success_label=success_label,
            )
        )

    return dataset