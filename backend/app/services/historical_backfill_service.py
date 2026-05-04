from __future__ import annotations

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