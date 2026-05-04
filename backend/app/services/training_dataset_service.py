from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Task, TaskAssignmentHistory, TaskOutcome

SUCCESS_LABEL_THRESHOLD = 65.0
UNCERTAIN_SCORE_MIN = 55.0
UNCERTAIN_SCORE_MAX = 70.0


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


def _compute_success_label(success_score: float) -> int:
    return 1 if float(success_score) >= SUCCESS_LABEL_THRESHOLD else 0


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

        success_label = _compute_success_label(success_score)

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


def _analyze_row_quality(row: dict[str, Any]) -> list[str]:
    reasons: list[str] = []

    success_score = float(row.get("success_score") or 0)
    required_skills_count = int(row.get("required_skills_count") or 0)
    matching_ratio = float(row.get("matching_ratio") or 0)
    complexity_snapshot = int(row.get("complexity_snapshot") or 0)
    recommendation_score = float(row.get("recommendation_score") or 0)
    skill_match_score = float(row.get("skill_match_score") or 0)
    source = (row.get("source") or "").strip().lower()

    if required_skills_count <= 0:
        reasons.append("no_required_skills")

    if not (0.0 <= matching_ratio <= 1.0):
        reasons.append("invalid_matching_ratio")

    if not (1 <= complexity_snapshot <= 5):
        reasons.append("invalid_complexity")

    if UNCERTAIN_SCORE_MIN <= success_score <= UNCERTAIN_SCORE_MAX:
        reasons.append("uncertain_success_band")

    if (
        source == "historical_backfill"
        and recommendation_score <= 0
        and skill_match_score <= 0
        and matching_ratio == 0
    ):
        reasons.append("weak_backfill_signal")

    return reasons


def build_clean_training_dataset_rows(db: Session) -> dict[str, Any]:
    raw_rows = build_training_dataset_rows(db)

    clean_rows: list[dict[str, Any]] = []
    excluded_rows: list[dict[str, Any]] = []
    excluded_by_reason: dict[str, int] = {}

    for row in raw_rows:
        reasons = _analyze_row_quality(row)

        if reasons:
            excluded_rows.append(
                {
                    "assignment_decision_id": row["assignment_decision_id"],
                    "task_id": row["task_id"],
                    "reasons": reasons,
                }
            )
            for reason in reasons:
                excluded_by_reason[reason] = excluded_by_reason.get(reason, 0) + 1
        else:
            clean_rows.append(row)

    return {
        "raw_rows": raw_rows,
        "clean_rows": clean_rows,
        "excluded_rows": excluded_rows,
        "excluded_by_reason": excluded_by_reason,
    }


def _distribution(rows: list[dict[str, Any]], field: str) -> dict[str, int]:
    result: dict[str, int] = {}

    for row in rows:
        value = row.get(field)
        label = str(value) if value not in (None, "") else "NO_DEFINIDO"
        result[label] = result.get(label, 0) + 1

    return result


def build_training_dataset_preview(db: Session, limit: int = 20) -> dict[str, Any]:
    rows = build_training_dataset_rows(db)

    return {
        "total_rows": len(rows),
        "label_distribution": _distribution(rows, "success_label"),
        "source_distribution": _distribution(rows, "source"),
        "strategy_distribution": _distribution(rows, "strategy"),
        "sample_rows": rows[:limit],
    }


def build_clean_training_dataset_preview(db: Session, limit: int = 20) -> dict[str, Any]:
    dataset = build_clean_training_dataset_rows(db)
    raw_rows = dataset["raw_rows"]
    clean_rows = dataset["clean_rows"]
    excluded_rows = dataset["excluded_rows"]
    excluded_by_reason = dataset["excluded_by_reason"]

    return {
        "raw_total_rows": len(raw_rows),
        "clean_total_rows": len(clean_rows),
        "excluded_rows": len(excluded_rows),
        "excluded_by_reason": excluded_by_reason,
        "label_distribution": _distribution(clean_rows, "success_label"),
        "source_distribution": _distribution(clean_rows, "source"),
        "strategy_distribution": _distribution(clean_rows, "strategy"),
        "sample_rows": clean_rows[:limit],
        "sample_excluded_rows": excluded_rows[:limit],
    }