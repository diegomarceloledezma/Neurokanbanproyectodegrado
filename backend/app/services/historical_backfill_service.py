from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import Task, TaskAssignmentHistory, TaskOutcome
from app.services.recommendation_engine import (
    build_assignment_snapshot_data,
    load_task_or_none,
)


def infer_backfill_strategy(task: Task) -> str:
    if task.priority in {"critical", "high"}:
        return "urgency"

    if task.task_type in {"feature", "bug", "improvement"} and task.complexity >= 4:
        return "efficiency"

    if task.task_type in {"documentation", "research"}:
        return "balance"

    if task.task_type in {"design", "marketing", "operations"}:
        return "balance"

    if task.complexity <= 2:
        return "learning"

    return "balance"


def _compute_outcome_score(
    *,
    finished_on_time: bool,
    delay_hours: float,
    quality_score: int,
    had_rework: bool,
) -> float:
    score = 0.0
    if finished_on_time:
        score += 35
    else:
        score += max(0.0, 15 - float(delay_hours or 0) * 1.8)

    score += int(quality_score or 0) * 12
    score += -8 if had_rework else 10
    return round(max(0.0, min(100.0, score)), 2)


def _infer_missing_outcome_values(task: Task) -> dict[str, Any]:
    estimated_hours = float(task.estimated_hours or 0)
    actual_hours = float(task.actual_hours or task.estimated_hours or 0)

    if estimated_hours > 0 and actual_hours > 0:
        finished_on_time = actual_hours <= estimated_hours * 1.12
        delay_hours = round(max(actual_hours - estimated_hours, 0.0), 2)
    else:
        finished_on_time = True
        delay_hours = 0.0

    if task.priority == "critical":
        base_quality = 4
    elif task.complexity >= 4:
        base_quality = 3
    else:
        base_quality = 4

    if not finished_on_time:
        base_quality -= 1

    quality_score = max(2, min(5, base_quality))
    had_rework = bool(actual_hours > 0 and estimated_hours > 0 and actual_hours >= estimated_hours * 1.28)
    rework_count = 1 if had_rework else 0
    success_score = _compute_outcome_score(
        finished_on_time=finished_on_time,
        delay_hours=delay_hours,
        quality_score=quality_score,
        had_rework=had_rework,
    )

    completed_at = task.updated_at or datetime.utcnow()

    return {
        "completed_at": completed_at,
        "finished_on_time": finished_on_time,
        "delay_hours": delay_hours,
        "quality_score": quality_score,
        "had_rework": had_rework,
        "rework_count": rework_count,
        "success_score": success_score,
        "notes": "Outcome inferido automáticamente desde tarea finalizada sin outcome registrado.",
    }


def backfill_missing_outcomes_from_completed_tasks(db: Session, limit: int = 300) -> dict[str, Any]:
    candidates = (
        db.query(Task)
        .filter(Task.assigned_to.isnot(None))
        .filter(Task.status == "done")
        .filter(~Task.outcome.has())
        .order_by(Task.id.asc())
        .limit(limit)
        .all()
    )

    created = 0
    skipped = 0
    failed = 0
    created_task_ids: list[int] = []
    skipped_task_ids: list[int] = []
    failed_items: list[dict[str, Any]] = []

    for task in candidates:
        try:
            if not task.assigned_to:
                skipped += 1
                skipped_task_ids.append(task.id)
                continue

            values = _infer_missing_outcome_values(task)
            outcome = TaskOutcome(
                task_id=task.id,
                completed_at=values["completed_at"],
                finished_on_time=values["finished_on_time"],
                delay_hours=values["delay_hours"],
                quality_score=values["quality_score"],
                had_rework=values["had_rework"],
                rework_count=values["rework_count"],
                success_score=values["success_score"],
                notes=values["notes"],
            )
            db.add(outcome)
            created += 1
            created_task_ids.append(task.id)
        except Exception as exc:
            failed += 1
            failed_items.append({"task_id": task.id, "error": str(exc)})

    db.commit()

    return {
        "message": "Backfill de outcomes ejecutado correctamente",
        "candidates_found": len(candidates),
        "created": created,
        "skipped": skipped,
        "failed": failed,
        "created_task_ids": created_task_ids[:20],
        "skipped_task_ids": skipped_task_ids[:20],
        "failed_items": failed_items[:20],
    }


def backfill_assignment_history_from_existing_tasks(db: Session, limit: int = 200) -> dict[str, Any]:
    candidates = (
        db.query(Task)
        .join(TaskOutcome, TaskOutcome.task_id == Task.id)
        .filter(Task.assigned_to.isnot(None))
        .filter(~Task.assignment_history.any())
        .order_by(Task.id.asc())
        .limit(limit)
        .all()
    )

    created = 0
    skipped = 0
    failed = 0
    created_task_ids: list[int] = []
    skipped_task_ids: list[int] = []
    failed_items: list[dict[str, Any]] = []

    for task_row in candidates:
        try:
            task = load_task_or_none(db, task_row.id)
            if not task or not task.assigned_to:
                skipped += 1
                skipped_task_ids.append(task_row.id)
                continue

            strategy = infer_backfill_strategy(task)

            snapshot = build_assignment_snapshot_data(
                db=db,
                task=task,
                assigned_user_id=task.assigned_to,
                strategy=strategy,
            )

            if not snapshot:
                skipped += 1
                skipped_task_ids.append(task.id)
                continue

            history = TaskAssignmentHistory(
                task_id=task.id,
                assigned_to=task.assigned_to,
                assigned_by=None,
                source="historical_backfill",
                strategy=strategy,
                recommendation_score=snapshot.get("recommendation_score"),
                risk_level=snapshot.get("risk_level"),
                reason="Registro histórico reconstruido a partir de tarea asignada con resultado final existente.",
                recommendation_used=False,
                workload_score=snapshot.get("workload_score"),
                skill_match_score=snapshot.get("skill_match_score"),
                availability_score=snapshot.get("availability_score"),
                performance_score=snapshot.get("performance_score"),
                current_load_snapshot=snapshot.get("current_load_snapshot"),
                availability_snapshot=snapshot.get("availability_snapshot"),
                active_tasks_snapshot=snapshot.get("active_tasks_snapshot"),
                required_skills_count=snapshot.get("required_skills_count"),
                matching_skills_count=snapshot.get("matching_skills_count"),
                matching_ratio=snapshot.get("matching_ratio"),
                estimated_hours_snapshot=snapshot.get("estimated_hours_snapshot"),
                priority_snapshot=snapshot.get("priority_snapshot"),
                complexity_snapshot=snapshot.get("complexity_snapshot"),
            )

            db.add(history)
            created += 1
            created_task_ids.append(task.id)

        except Exception as exc:
            failed += 1
            failed_items.append(
                {
                    "task_id": task_row.id,
                    "error": str(exc),
                }
            )

    db.commit()

    return {
        "message": "Backfill de historial de asignación ejecutado correctamente",
        "candidates_found": len(candidates),
        "created": created,
        "skipped": skipped,
        "failed": failed,
        "created_task_ids": created_task_ids[:20],
        "skipped_task_ids": skipped_task_ids[:20],
        "failed_items": failed_items[:20],
    }