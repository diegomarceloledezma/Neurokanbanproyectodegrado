from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

from sqlalchemy.orm import Session

from app.models import Task, TaskAssignmentHistory, TaskOutcome

SUCCESS_LABEL_THRESHOLD = 65.0
UNCERTAIN_SCORE_MIN = 55.0
UNCERTAIN_SCORE_MAX = 70.0


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return round(max(min_value, min(max_value, float(value))), 2)


def _safe_ratio(matching_skills_count: int | None, required_skills_count: int | None) -> float:
    if required_skills_count is None or required_skills_count <= 0:
        return 0.0
    if matching_skills_count is None:
        return 0.0
    return round(float(matching_skills_count) / float(required_skills_count), 4)


def _normalize_matching_ratio(value: float | int | None) -> float:
    """
    Normaliza el ratio de coincidencia de habilidades al rango 0..1.

    En versiones anteriores algunos registros sintéticos podían guardar este
    dato como porcentaje (por ejemplo 66.0) mientras que el motor de
    recomendación usa proporción (0.66). Esta normalización evita perder filas
    útiles del dataset por una diferencia de escala.
    """
    if value is None:
        return 0.0

    try:
        ratio = float(value)
    except Exception:
        return 0.0

    if ratio > 1.0 and ratio <= 100.0:
        ratio = ratio / 100.0

    return round(max(0.0, min(1.0, ratio)), 4)


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


def _distribution(rows: list[dict[str, Any]], field: str) -> dict[str, int]:
    result: dict[str, int] = {}

    for row in rows:
        value = row.get(field)
        label = str(value) if value not in (None, "") else "NO_DEFINIDO"
        result[label] = result.get(label, 0) + 1

    return result


def _class_balance(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {
            "negative_count": 0,
            "positive_count": 0,
            "minority_ratio_percent": 0.0,
            "assessment": "sin_datos",
        }

    negatives = sum(1 for row in rows if int(row.get("success_label", 0)) == 0)
    positives = sum(1 for row in rows if int(row.get("success_label", 0)) == 1)
    minority = min(negatives, positives)
    total = len(rows)
    minority_ratio = round((minority / total) * 100, 2) if total > 0 else 0.0

    if minority_ratio >= 35:
        assessment = "alto"
    elif minority_ratio >= 20:
        assessment = "medio"
    else:
        assessment = "bajo"

    return {
        "negative_count": negatives,
        "positive_count": positives,
        "minority_ratio_percent": minority_ratio,
        "assessment": assessment,
    }


def _neutral_rate() -> float:
    return 50.0


def _neutral_quality_index() -> float:
    return 60.0


def _default_history_state() -> dict[str, Any]:
    return {
        "count": 0,
        "success_positive": 0,
        "success_sum": 0.0,
        "on_time_count": 0,
        "on_time_positive": 0,
        "quality_count": 0,
        "quality_sum": 0.0,
        "no_rework_count": 0,
        "no_rework_positive": 0,
        "recent_success_labels": deque(maxlen=5),
        "task_type_counts": defaultdict(int),
        "task_type_success": defaultdict(int),
        "priority_counts": defaultdict(int),
        "priority_success": defaultdict(int),
    }


def _history_features_from_state(
    state: dict[str, Any],
    *,
    task_type: str,
    priority: str,
) -> dict[str, Any]:
    count = int(state["count"])

    if count > 0:
        historical_success_rate = round((state["success_positive"] / count) * 100, 2)
        historical_avg_success_score = round(state["success_sum"] / count, 2)
    else:
        historical_success_rate = _neutral_rate()
        historical_avg_success_score = 60.0

    if int(state["on_time_count"]) > 0:
        historical_on_time_rate = round(
            (state["on_time_positive"] / state["on_time_count"]) * 100,
            2,
        )
    else:
        historical_on_time_rate = _neutral_rate()

    if int(state["quality_count"]) > 0:
        historical_quality_index = round(
            ((state["quality_sum"] / state["quality_count"]) * 20.0),
            2,
        )
    else:
        historical_quality_index = _neutral_quality_index()

    if int(state["no_rework_count"]) > 0:
        historical_no_rework_rate = round(
            (state["no_rework_positive"] / state["no_rework_count"]) * 100,
            2,
        )
    else:
        historical_no_rework_rate = _neutral_rate()

    recent_labels = list(state["recent_success_labels"])
    if recent_labels:
        recent_5_success_rate = round((sum(recent_labels) / len(recent_labels)) * 100, 2)
    else:
        recent_5_success_rate = historical_success_rate

    same_task_type_history_count = int(state["task_type_counts"].get(task_type, 0))
    if same_task_type_history_count > 0:
        same_task_type_success_rate = round(
            (state["task_type_success"][task_type] / same_task_type_history_count) * 100,
            2,
        )
    else:
        same_task_type_success_rate = historical_success_rate

    same_priority_history_count = int(state["priority_counts"].get(priority, 0))
    if same_priority_history_count > 0:
        same_priority_success_rate = round(
            (state["priority_success"][priority] / same_priority_history_count) * 100,
            2,
        )
    else:
        same_priority_success_rate = historical_success_rate

    return {
        "historical_tasks_with_outcome": count,
        "historical_success_rate": historical_success_rate,
        "historical_avg_success_score": historical_avg_success_score,
        "historical_on_time_rate": historical_on_time_rate,
        "historical_quality_index": historical_quality_index,
        "historical_no_rework_rate": historical_no_rework_rate,
        "same_task_type_history_count": same_task_type_history_count,
        "same_task_type_success_rate": same_task_type_success_rate,
        "same_priority_history_count": same_priority_history_count,
        "same_priority_success_rate": same_priority_success_rate,
        "recent_5_success_rate": recent_5_success_rate,
    }


def _update_history_state(
    state: dict[str, Any],
    *,
    task_type: str,
    priority: str,
    success_score: float,
    success_label: int,
    finished_on_time: bool | None,
    quality_score: int | None,
    had_rework: bool | None,
) -> None:
    state["count"] += 1
    state["success_positive"] += int(success_label)
    state["success_sum"] += float(success_score)
    state["recent_success_labels"].append(int(success_label))

    state["task_type_counts"][task_type] += 1
    state["task_type_success"][task_type] += int(success_label)

    state["priority_counts"][priority] += 1
    state["priority_success"][priority] += int(success_label)

    if finished_on_time is not None:
        state["on_time_count"] += 1
        if finished_on_time:
            state["on_time_positive"] += 1

    if quality_score is not None:
        state["quality_count"] += 1
        state["quality_sum"] += float(quality_score)

    if had_rework is not None:
        state["no_rework_count"] += 1
        if not had_rework:
            state["no_rework_positive"] += 1


def build_training_dataset_rows(db: Session) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    history_items = (
        db.query(TaskAssignmentHistory, Task, TaskOutcome)
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
        .join(TaskOutcome, TaskOutcome.task_id == Task.id)
        .order_by(TaskAssignmentHistory.created_at.asc(), TaskAssignmentHistory.id.asc())
        .all()
    )

    user_history: dict[int, dict[str, Any]] = defaultdict(_default_history_state)

    for history, task, outcome in history_items:
        raw_matching_ratio = (
            float(history.matching_ratio)
            if history.matching_ratio is not None
            else _safe_ratio(history.matching_skills_count, history.required_skills_count)
        )
        matching_ratio = _normalize_matching_ratio(raw_matching_ratio)

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

        task_type_snapshot = str(task.task_type or "other")
        priority_snapshot = str(history.priority_snapshot or task.priority or "medium")

        state = user_history[int(history.assigned_to)]
        historical_features = _history_features_from_state(
            state,
            task_type=task_type_snapshot,
            priority=priority_snapshot,
        )

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
                "priority_snapshot": priority_snapshot,
                "task_type_snapshot": task_type_snapshot,
                "complexity_snapshot": int(history.complexity_snapshot or task.complexity or 0),
                "snapshot_quality": "original",
                "finished_on_time": outcome.finished_on_time,
                "delay_hours": float(outcome.delay_hours or 0),
                "quality_score": int(outcome.quality_score or 0),
                "had_rework": bool(outcome.had_rework),
                "success_score": float(success_score),
                "success_label": int(success_label),
                **historical_features,
            }
        )

        _update_history_state(
            state,
            task_type=task_type_snapshot,
            priority=priority_snapshot,
            success_score=float(success_score),
            success_label=int(success_label),
            finished_on_time=outcome.finished_on_time,
            quality_score=outcome.quality_score,
            had_rework=outcome.had_rework,
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
    current_load_snapshot = float(row.get("current_load_snapshot") or 0)
    availability_snapshot = float(row.get("availability_snapshot") or 0)

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

    if current_load_snapshot > 100 or availability_snapshot > 100:
        reasons.append("invalid_operational_snapshot")

    return reasons


def _repair_operational_snapshot(row: dict[str, Any]) -> dict[str, Any]:
    repaired = dict(row)

    source = (repaired.get("source") or "").strip().lower()
    current_load = float(repaired.get("current_load_snapshot") or 0)
    availability = float(repaired.get("availability_snapshot") or 0)
    workload_score = float(repaired.get("workload_score") or 0)
    availability_score = float(repaired.get("availability_score") or 0)
    active_tasks = int(repaired.get("active_tasks_snapshot") or 0)
    estimated_hours = float(repaired.get("estimated_hours_snapshot") or 0)

    repaired["snapshot_repaired"] = False
    repaired["snapshot_quality"] = "original"
    repaired["current_load_snapshot_original"] = current_load
    repaired["availability_snapshot_original"] = availability

    if source not in {"historical_backfill", "benchmark_batch"}:
        return repaired

    is_extreme_pair = current_load >= 95 and availability <= 5
    is_stressed_pair = current_load >= 90 and availability <= 10

    if not (is_extreme_pair or is_stressed_pair):
        return repaired

    if workload_score > 0:
        proxy_load = _clamp(100 - workload_score, 20, 85)
    else:
        proxy_load = _clamp(25 + (active_tasks * 7) + (estimated_hours * 1.4), 25, 85)

    if availability_score > 0:
        proxy_availability = _clamp(availability_score, 15, 80)
    else:
        proxy_availability = _clamp(100 - proxy_load, 15, 80)

    repaired["current_load_snapshot"] = proxy_load
    repaired["availability_snapshot"] = proxy_availability
    repaired["snapshot_repaired"] = True
    repaired["snapshot_quality"] = "repaired"

    return repaired


def _analyze_trusted_row_quality(row: dict[str, Any]) -> list[str]:
    reasons: list[str] = []

    source = (row.get("source") or "").strip().lower()
    success_score = float(row.get("success_score") or 0)
    required_skills_count = int(row.get("required_skills_count") or 0)
    matching_ratio = float(row.get("matching_ratio") or 0)
    skill_match_score = float(row.get("skill_match_score") or 0)
    recommendation_score = float(row.get("recommendation_score") or 0)
    current_load_snapshot = float(row.get("current_load_snapshot") or 0)
    availability_snapshot = float(row.get("availability_snapshot") or 0)
    complexity_snapshot = int(row.get("complexity_snapshot") or 0)

    reasons.extend(_analyze_row_quality(row))

    if required_skills_count > 0 and matching_ratio == 0 and skill_match_score < 25:
        reasons.append("low_skill_signal")

    if current_load_snapshot >= 100 and availability_snapshot <= 0 and recommendation_score < 30:
        reasons.append("extreme_operational_snapshot")

    if source == "benchmark_batch":
        if success_score >= 52 and success_score <= 76:
            reasons.append("benchmark_uncertain_success_band")

        if required_skills_count > 0 and matching_ratio < 0.34 and skill_match_score < 30:
            reasons.append("benchmark_low_skill_fit")

        if current_load_snapshot >= 95 and availability_snapshot <= 5:
            reasons.append("benchmark_overloaded_snapshot")

        if complexity_snapshot >= 4 and matching_ratio == 0:
            reasons.append("benchmark_high_complexity_low_fit")

    if source == "historical_backfill":
        if matching_ratio == 0 and skill_match_score < 35:
            reasons.append("backfill_low_skill_fit")

        if recommendation_score < 18 and skill_match_score < 35:
            reasons.append("backfill_low_decision_signal")

    return list(dict.fromkeys(reasons))


def _analyze_recalibrated_row_quality(row: dict[str, Any]) -> list[str]:
    reasons: list[str] = []

    source = (row.get("source") or "").strip().lower()
    success_score = float(row.get("success_score") or 0)
    required_skills_count = int(row.get("required_skills_count") or 0)
    matching_ratio = float(row.get("matching_ratio") or 0)
    skill_match_score = float(row.get("skill_match_score") or 0)
    recommendation_score = float(row.get("recommendation_score") or 0)
    current_load_snapshot = float(row.get("current_load_snapshot") or 0)
    availability_snapshot = float(row.get("availability_snapshot") or 0)
    snapshot_repaired = bool(row.get("snapshot_repaired"))
    complexity_snapshot = int(row.get("complexity_snapshot") or 0)

    if required_skills_count <= 0:
        reasons.append("no_required_skills")

    if not (0.0 <= matching_ratio <= 1.0):
        reasons.append("invalid_matching_ratio")

    if not (1 <= complexity_snapshot <= 5):
        reasons.append("invalid_complexity")

    if UNCERTAIN_SCORE_MIN <= success_score <= UNCERTAIN_SCORE_MAX:
        reasons.append("uncertain_success_band")

    if current_load_snapshot > 100 or availability_snapshot > 100:
        reasons.append("invalid_operational_snapshot")

    if source == "historical_backfill":
        if matching_ratio == 0 and skill_match_score < 35:
            reasons.append("backfill_low_skill_fit")

        if recommendation_score < 20 and skill_match_score < 50 and matching_ratio < 0.5:
            reasons.append("backfill_low_decision_signal")

    if source == "benchmark_batch":
        if matching_ratio < 0.34 and skill_match_score < 35:
            reasons.append("benchmark_low_skill_fit")

        if 58 <= success_score <= 72:
            reasons.append("benchmark_uncertain_success_band")

        if (current_load_snapshot >= 90 and availability_snapshot <= 10) and not snapshot_repaired:
            reasons.append("benchmark_extreme_snapshot")

    return list(dict.fromkeys(reasons))


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
        "class_balance": _class_balance(clean_rows),
    }


def build_trusted_training_dataset_rows(db: Session) -> dict[str, Any]:
    raw_rows = build_training_dataset_rows(db)

    trusted_rows: list[dict[str, Any]] = []
    excluded_rows: list[dict[str, Any]] = []
    excluded_by_reason: dict[str, int] = {}

    for row in raw_rows:
        reasons = _analyze_trusted_row_quality(row)

        if reasons:
            excluded_rows.append(
                {
                    "assignment_decision_id": row["assignment_decision_id"],
                    "task_id": row["task_id"],
                    "source": row.get("source"),
                    "reasons": reasons,
                }
            )
            for reason in reasons:
                excluded_by_reason[reason] = excluded_by_reason.get(reason, 0) + 1
        else:
            trusted_rows.append(row)

    return {
        "raw_rows": raw_rows,
        "trusted_rows": trusted_rows,
        "excluded_rows": excluded_rows,
        "excluded_by_reason": excluded_by_reason,
        "class_balance": _class_balance(trusted_rows),
    }


def build_recalibrated_training_dataset_rows(db: Session) -> dict[str, Any]:
    clean_dataset = build_clean_training_dataset_rows(db)
    base_rows = clean_dataset["clean_rows"]

    recalibrated_rows: list[dict[str, Any]] = []
    excluded_rows: list[dict[str, Any]] = []
    excluded_by_reason: dict[str, int] = {}

    repaired_count = 0

    for row in base_rows:
        repaired_row = _repair_operational_snapshot(row)

        if repaired_row.get("snapshot_repaired"):
            repaired_count += 1

        reasons = _analyze_recalibrated_row_quality(repaired_row)

        if reasons:
            excluded_rows.append(
                {
                    "assignment_decision_id": repaired_row["assignment_decision_id"],
                    "task_id": repaired_row["task_id"],
                    "source": repaired_row.get("source"),
                    "reasons": reasons,
                }
            )
            for reason in reasons:
                excluded_by_reason[reason] = excluded_by_reason.get(reason, 0) + 1
        else:
            recalibrated_rows.append(repaired_row)

    return {
        "raw_rows": clean_dataset["raw_rows"],
        "base_clean_rows": base_rows,
        "recalibrated_rows": recalibrated_rows,
        "excluded_rows": excluded_rows,
        "excluded_by_reason": excluded_by_reason,
        "class_balance": _class_balance(recalibrated_rows),
        "repaired_snapshot_rows": repaired_count,
    }


def build_training_dataset_preview(db: Session, limit: int = 20) -> dict[str, Any]:
    rows = build_training_dataset_rows(db)

    return {
        "total_rows": len(rows),
        "label_distribution": _distribution(rows, "success_label"),
        "source_distribution": _distribution(rows, "source"),
        "strategy_distribution": _distribution(rows, "strategy"),
        "class_balance": _class_balance(rows),
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
        "class_balance": dataset["class_balance"],
        "sample_rows": clean_rows[:limit],
        "sample_excluded_rows": excluded_rows[:limit],
    }


def build_trusted_training_dataset_preview(db: Session, limit: int = 20) -> dict[str, Any]:
    dataset = build_trusted_training_dataset_rows(db)
    raw_rows = dataset["raw_rows"]
    trusted_rows = dataset["trusted_rows"]
    excluded_rows = dataset["excluded_rows"]

    return {
        "raw_total_rows": len(raw_rows),
        "trusted_total_rows": len(trusted_rows),
        "excluded_rows": len(excluded_rows),
        "excluded_by_reason": dataset["excluded_by_reason"],
        "label_distribution": _distribution(trusted_rows, "success_label"),
        "source_distribution": _distribution(trusted_rows, "source"),
        "strategy_distribution": _distribution(trusted_rows, "strategy"),
        "class_balance": dataset["class_balance"],
        "sample_rows": trusted_rows[:limit],
        "sample_excluded_rows": excluded_rows[:limit],
    }


def build_recalibrated_training_dataset_preview(db: Session, limit: int = 20) -> dict[str, Any]:
    dataset = build_recalibrated_training_dataset_rows(db)
    rows = dataset["recalibrated_rows"]
    excluded_rows = dataset["excluded_rows"]

    return {
        "raw_total_rows": len(dataset["raw_rows"]),
        "base_clean_total_rows": len(dataset["base_clean_rows"]),
        "recalibrated_total_rows": len(rows),
        "excluded_rows": len(excluded_rows),
        "repaired_snapshot_rows": dataset["repaired_snapshot_rows"],
        "excluded_by_reason": dataset["excluded_by_reason"],
        "label_distribution": _distribution(rows, "success_label"),
        "source_distribution": _distribution(rows, "source"),
        "strategy_distribution": _distribution(rows, "strategy"),
        "class_balance": dataset["class_balance"],
        "sample_rows": rows[:limit],
        "sample_excluded_rows": excluded_rows[:limit],
    }


def build_training_growth_summary(db: Session) -> dict[str, Any]:
    raw_rows = build_training_dataset_rows(db)
    clean_dataset = build_clean_training_dataset_rows(db)
    clean_rows = clean_dataset["clean_rows"]
    trusted_dataset = build_trusted_training_dataset_rows(db)
    trusted_rows = trusted_dataset["trusted_rows"]
    recalibrated_dataset = build_recalibrated_training_dataset_rows(db)
    recalibrated_rows = recalibrated_dataset["recalibrated_rows"]

    benchmark_rows = [row for row in raw_rows if str(row.get("source") or "") == "benchmark_batch"]
    backfill_rows = [row for row in raw_rows if str(row.get("source") or "") == "historical_backfill"]
    hybrid_rows = [row for row in raw_rows if str(row.get("source") or "") == "hybrid"]

    unique_projects = len({int(row["project_id"]) for row in raw_rows if row.get("project_id") is not None})
    unique_tasks = len({int(row["task_id"]) for row in raw_rows if row.get("task_id") is not None})

    clean_rate = round((len(clean_rows) / len(raw_rows)) * 100, 2) if raw_rows else 0.0
    trusted_rate = round((len(trusted_rows) / len(raw_rows)) * 100, 2) if raw_rows else 0.0
    recalibrated_rate = round((len(recalibrated_rows) / len(raw_rows)) * 100, 2) if raw_rows else 0.0

    return {
        "raw_total_rows": len(raw_rows),
        "clean_total_rows": len(clean_rows),
        "trusted_total_rows": len(trusted_rows),
        "recalibrated_total_rows": len(recalibrated_rows),
        "excluded_total_rows": len(clean_dataset["excluded_rows"]),
        "trusted_excluded_total_rows": len(trusted_dataset["excluded_rows"]),
        "recalibrated_excluded_total_rows": len(recalibrated_dataset["excluded_rows"]),
        "clean_rate_percent": clean_rate,
        "trusted_rate_percent": trusted_rate,
        "recalibrated_rate_percent": recalibrated_rate,
        "repaired_snapshot_rows": recalibrated_dataset["repaired_snapshot_rows"],
        "unique_projects_covered": unique_projects,
        "unique_tasks_covered": unique_tasks,
        "source_distribution": _distribution(raw_rows, "source"),
        "strategy_distribution": _distribution(raw_rows, "strategy"),
        "raw_class_balance": _class_balance(raw_rows),
        "clean_class_balance": clean_dataset["class_balance"],
        "trusted_class_balance": trusted_dataset["class_balance"],
        "recalibrated_class_balance": recalibrated_dataset["class_balance"],
        "excluded_by_reason": clean_dataset["excluded_by_reason"],
        "trusted_excluded_by_reason": trusted_dataset["excluded_by_reason"],
        "recalibrated_excluded_by_reason": recalibrated_dataset["excluded_by_reason"],
        "benchmark_batch_rows": len(benchmark_rows),
        "historical_backfill_rows": len(backfill_rows),
        "hybrid_rows": len(hybrid_rows),
    }