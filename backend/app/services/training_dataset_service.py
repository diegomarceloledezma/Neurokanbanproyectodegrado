from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Task, TaskAssignmentHistory, TaskOutcome


def _safe_ratio(matching_skills_count: int | None, required_skills_count: int | None) -> float:
    if required_skills_count is None or required_skills_count <= 0:
        return 0.0
    if matching_skills_count is None:
        return 0.0
    return round(float(matching_skills_count) / float(required_skills_count), 4)


def _compute_success_score(
    *,
    finished_on_time: bool | None,
    delay_hours: float | None,
    quality_score: int | None,
    had_rework: bool | None,
) -> float:
    score = 0.0

    if finished_on_time is True:
        score += 35
    else:
        score += max(0.0, 15 - float(delay_hours or 0) * 1.8)

    score += int(quality_score or 0) * 12
    score += -8 if had_rework else 10

    return round(max(0.0, min(100.0, score)), 2)


def build_training_dataset_rows(db: Session) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    history_items = (
        db.query(TaskAssignmentHistory, Task, TaskOutcome)
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
        .join(TaskOutcome, TaskOutcome.task_id == Task.id)
        .order_by(TaskAssignmentHistory.id.asc())
        .all()
    )

    for history, task, outcome in history_items:
        matching_ratio = (
            float(history.matching_ratio)
            if history.matching_ratio is not None
            else _safe_ratio(history.matching_skills_count, history.required_skills_count)
        )

        success_score = (
            float(outcome.success_score)
            if outcome.success_score is not None
            else _compute_success_score(
                finished_on_time=outcome.finished_on_time,
                delay_hours=outcome.delay_hours,
                quality_score=outcome.quality_score,
                had_rework=outcome.had_rework,
            )
        )

        success_label = 1 if success_score >= 60 else 0

        rows.append(
            {
                "assignment_decision_id": history.id,
                "task_id": task.id,
                "project_id": task.project_id,
                "assigned_to": history.assigned_to,
                "source": history.source,
                "strategy": history.strategy,
                "recommendation_used": bool(history.recommendation_used),
                "recommendation_score": float(history.recommendation_score or 0),
                "workload_score": float(history.workload_score or 0),
                "skill_match_score": float(history.skill_match_score or 0),
                "availability_score": float(history.availability_score or 0),
                "performance_score": float(history.performance_score or 0),
                "current_load_snapshot": float(history.current_load_snapshot or 0),
                "availability_snapshot": float(history.availability_snapshot or 0),
                "active_tasks_snapshot": int(history.active_tasks_snapshot or 0),
                "required_skills_count": int(history.required_skills_count or 0),
                "matching_skills_count": int(history.matching_skills_count or 0),
                "matching_ratio": float(matching_ratio),
                "estimated_hours_snapshot": float(history.estimated_hours_snapshot or 0),
                "priority_snapshot": history.priority_snapshot or task.priority,
                "complexity_snapshot": int(history.complexity_snapshot or task.complexity or 0),
                "finished_on_time": outcome.finished_on_time,
                "delay_hours": float(outcome.delay_hours or 0),
                "quality_score": int(outcome.quality_score or 0),
                "had_rework": bool(outcome.had_rework),
                "success_score": float(success_score),
                "success_label": int(success_label),
            }
        )

    return rows


def build_training_dataset_preview(db: Session, limit: int = 20) -> dict[str, Any]:
    rows = build_training_dataset_rows(db)

    source_counts: dict[str, int] = {}
    strategy_counts: dict[str, int] = {}
    label_counts = {"0": 0, "1": 0}

    for row in rows:
        source = row["source"] or "NO_DEFINIDO"
        strategy = row["strategy"] or "NO_DEFINIDO"
        label = str(row["success_label"])

        source_counts[source] = source_counts.get(source, 0) + 1
        strategy_counts[strategy] = strategy_counts.get(strategy, 0) + 1
        label_counts[label] = label_counts.get(label, 0) + 1

    return {
        "total_rows": len(rows),
        "label_distribution": label_counts,
        "source_distribution": source_counts,
        "strategy_distribution": strategy_counts,
        "sample_rows": rows[:limit],
    }