from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Project,
    ProjectMember,
    Recommendation,
    Task,
    TaskOutcome,
    TaskRequiredSkill,
    User,
    UserSkill,
)
from app.schemas import (
    RecommendationMember,
    TaskRecommendationItem,
    TaskRecommendationResponse,
    TaskSimulationItem,
    TaskSimulationResponse,
)
from app.services.ml_baseline_service import (
    build_feature_payload,
    get_baseline_status,
    load_baseline_metadata,
    load_baseline_model,
    predict_success_probability_from_features,
)

ALLOWED_STRATEGIES = {"balance", "efficiency", "urgency", "learning"}
ALLOWED_MODES = {"heuristic", "hybrid"}
ACTIVE_STATUSES = {"pending", "in_progress", "review", "blocked"}
COMPLETED_STATUSES = {"done"}

FEASIBILITY_RULES = {
    "balance": {"min_availability": 20, "max_load": 85},
    "efficiency": {"min_availability": 15, "max_load": 80},
    "urgency": {"min_availability": 30, "max_load": 70},
    "learning": {"min_availability": 10, "max_load": 90},
}


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(value, high))


def _neutral_rate() -> float:
    return 50.0


def _neutral_quality_index() -> float:
    return 60.0


def _role_name(member: User) -> str:
    return member.global_role.name if member.global_role else "member"


def _compute_outcome_success_score(outcome: TaskOutcome) -> float:
    if outcome.success_score is not None:
        return round(float(outcome.success_score), 2)

    score = 0.0
    if outcome.finished_on_time:
        score += 35
    else:
        score += max(0.0, 15 - _to_float(outcome.delay_hours) * 1.8)

    score += int(outcome.quality_score or 0) * 12
    score += -8 if bool(outcome.had_rework) else 10
    return round(_clamp(score), 2)


def _compute_success_label(success_score: float) -> int:
    return 1 if float(success_score) >= 65.0 else 0


def _is_sqlite(db: Session) -> bool:
    bind = db.get_bind()
    return bind is not None and bind.dialect.name == "sqlite"


def _next_sqlite_pk(db: Session, model) -> int:
    current_max = db.query(func.max(model.id)).scalar()
    return int(current_max or 0) + 1


def _assignability_rank(status: str) -> int:
    if status == "assignable":
        return 3
    if status == "risky":
        return 2
    return 1


def _assignability_label(status: str) -> str:
    if status == "assignable":
        return "Asignable ahora"
    if status == "risky":
        return "Asignable con riesgo"
    return "No asignable ahora"


def _strategy_decision_threshold(metadata: dict[str, Any] | None, strategy: str) -> float:
    defaults = {
        "balance": 0.50,
        "efficiency": 0.53,
        "urgency": 0.58,
        "learning": 0.55,
    }
    if not metadata:
        return defaults.get(strategy, 0.50)

    strategy_thresholds = metadata.get("strategy_thresholds", {}) or {}
    value = strategy_thresholds.get(strategy)
    try:
        return float(value) if value is not None else defaults.get(strategy, 0.50)
    except Exception:
        return defaults.get(strategy, 0.50)


def _segment_confidence_adjustment(
    metadata: dict[str, Any] | None,
    *,
    strategy: str,
    task_type: str | None,
) -> tuple[float, str | None]:
    if not metadata:
        return 0.0, None

    robustness = metadata.get("segment_robustness_summary", {}) or {}
    weak_segments = robustness.get("weak_segments", {}) or {}

    penalty = 0.0
    notes: list[str] = []

    weak_strategies = set(weak_segments.get("strategy", []) or [])
    weak_task_types = set(weak_segments.get("task_type", []) or [])

    if strategy in weak_strategies:
        penalty += 0.05
        notes.append(f"el segmento {strategy} todavía es inestable en entrenamiento")

    normalized_task_type = str(task_type or "other")
    if normalized_task_type in weak_task_types:
        penalty += 0.04
        notes.append(f"el tipo de tarea {normalized_task_type} todavía presenta robustez limitada")

    penalty = min(0.12, penalty)
    return penalty, notes[0] if notes else None


def load_task_or_none(db: Session, task_id: int):
    return (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
            joinedload(Task.required_skills).joinedload(TaskRequiredSkill.skill),
            joinedload(Task.project)
            .joinedload(Project.members)
            .joinedload(ProjectMember.user)
            .joinedload(User.global_role),
            joinedload(Task.project)
            .joinedload(Project.members)
            .joinedload(ProjectMember.user)
            .joinedload(User.user_skills)
            .joinedload(UserSkill.skill),
        )
        .filter(Task.id == task_id)
        .first()
    )


def build_recommendation_member(member: User):
    role_name = _role_name(member)
    return RecommendationMember(
        id=member.id,
        full_name=member.full_name,
        email=member.email,
        role_name=role_name,
    )


def get_eligible_project_members(task: Task):
    if not task.project or not task.project.members:
        return []

    eligible: list[tuple[User, ProjectMember]] = []
    for membership in task.project.members:
        member = membership.user
        if not member or not member.is_active:
            continue

        role_name = _role_name(member)
        if role_name == "admin":
            continue

        eligible.append((member, membership))

    return eligible


def _build_history_profile(db: Session, member: User, reference_task: Task):
    outcome_rows = (
        db.query(Task, TaskOutcome)
        .join(TaskOutcome, TaskOutcome.task_id == Task.id)
        .filter(Task.assigned_to == member.id)
        .order_by(TaskOutcome.completed_at.asc().nullslast(), TaskOutcome.id.asc())
        .all()
    )

    count = len(outcome_rows)
    if count == 0:
        return {
            "historical_tasks_with_outcome": 0,
            "historical_success_rate": _neutral_rate(),
            "historical_avg_success_score": 60.0,
            "historical_on_time_rate": _neutral_rate(),
            "historical_quality_index": _neutral_quality_index(),
            "historical_no_rework_rate": _neutral_rate(),
            "same_task_type_history_count": 0,
            "same_task_type_success_rate": _neutral_rate(),
            "same_priority_history_count": 0,
            "same_priority_success_rate": _neutral_rate(),
            "recent_5_success_rate": _neutral_rate(),
        }

    success_scores: list[float] = []
    success_labels: list[int] = []
    on_time_values: list[int] = []
    quality_values: list[float] = []
    no_rework_values: list[int] = []

    same_task_type_labels: list[int] = []
    same_priority_labels: list[int] = []

    for past_task, outcome in outcome_rows:
        success_score = _compute_outcome_success_score(outcome)
        success_label = _compute_success_label(success_score)

        success_scores.append(success_score)
        success_labels.append(success_label)

        if outcome.finished_on_time is not None:
            on_time_values.append(1 if outcome.finished_on_time else 0)

        if outcome.quality_score is not None:
            quality_values.append(float(outcome.quality_score))

        no_rework_values.append(0 if bool(outcome.had_rework) else 1)

        if (past_task.task_type or "other") == (reference_task.task_type or "other"):
            same_task_type_labels.append(success_label)

        if (past_task.priority or "medium") == (reference_task.priority or "medium"):
            same_priority_labels.append(success_label)

    recent_labels = success_labels[-5:]

    historical_success_rate = round((sum(success_labels) / len(success_labels)) * 100, 2)
    historical_avg_success_score = round(sum(success_scores) / len(success_scores), 2)
    historical_on_time_rate = round((sum(on_time_values) / len(on_time_values)) * 100, 2) if on_time_values else _neutral_rate()
    historical_quality_index = round((sum(quality_values) / len(quality_values)) * 20.0, 2) if quality_values else _neutral_quality_index()
    historical_no_rework_rate = round((sum(no_rework_values) / len(no_rework_values)) * 100, 2) if no_rework_values else _neutral_rate()

    same_task_type_history_count = len(same_task_type_labels)
    same_task_type_success_rate = (
        round((sum(same_task_type_labels) / same_task_type_history_count) * 100, 2)
        if same_task_type_history_count > 0
        else historical_success_rate
    )

    same_priority_history_count = len(same_priority_labels)
    same_priority_success_rate = (
        round((sum(same_priority_labels) / same_priority_history_count) * 100, 2)
        if same_priority_history_count > 0
        else historical_success_rate
    )

    recent_5_success_rate = (
        round((sum(recent_labels) / len(recent_labels)) * 100, 2)
        if recent_labels
        else historical_success_rate
    )

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


def calculate_member_metrics(db: Session, member: User, project_membership: ProjectMember, reference_task: Task):
    assigned_tasks = (
        db.query(Task)
        .filter(Task.assigned_to == member.id)
        .order_by(Task.id.asc())
        .all()
    )

    active_tasks = [task for task in assigned_tasks if task.status in ACTIVE_STATUSES]
    completed_tasks = [task for task in assigned_tasks if task.status in COMPLETED_STATUSES]

    total_tasks = len(assigned_tasks)
    active_count = len(active_tasks)
    completed_count = len(completed_tasks)

    completion_rate = round((completed_count / total_tasks) * 100, 2) if total_tasks > 0 else 0.0
    total_active_hours = sum(_to_float(task.estimated_hours) for task in active_tasks)

    capacity_hours = _to_float(project_membership.weekly_capacity_hours, 40.0) or 40.0
    declared_availability = _to_float(project_membership.availability_percentage, 100.0)

    current_load = round(_clamp((total_active_hours / capacity_hours) * 100), 2)
    availability = round(min(declared_availability, max(100 - current_load, 0)), 2)

    quality_rows = (
        db.query(TaskOutcome)
        .join(Task, Task.id == TaskOutcome.task_id)
        .filter(Task.assigned_to == member.id, TaskOutcome.quality_score.isnot(None))
        .all()
    )

    avg_quality_score = 0.0
    if quality_rows:
        avg_quality_score = round(
            sum(_to_float(row.quality_score) for row in quality_rows) / len(quality_rows),
            2,
        )

    on_time_rows = (
        db.query(TaskOutcome)
        .join(Task, Task.id == TaskOutcome.task_id)
        .filter(Task.assigned_to == member.id, TaskOutcome.finished_on_time.isnot(None))
        .all()
    )

    on_time_rate = 0.0
    if on_time_rows:
        on_time_rate = round(
            (sum(1 for row in on_time_rows if row.finished_on_time) / len(on_time_rows)) * 100,
            2,
        )

    rework_rows = (
        db.query(TaskOutcome)
        .join(Task, Task.id == TaskOutcome.task_id)
        .filter(Task.assigned_to == member.id, TaskOutcome.had_rework.isnot(None))
        .all()
    )

    no_rework_rate = 100.0
    if rework_rows:
        no_rework_rate = round(
            (sum(1 for row in rework_rows if not row.had_rework) / len(rework_rows)) * 100,
            2,
        )

    overdue_active_tasks = 0
    today = date.today()
    for task in active_tasks:
        if task.due_date and task.due_date < today:
            overdue_active_tasks += 1

    history_profile = _build_history_profile(db, member, reference_task)

    return {
        "active_tasks": active_count,
        "completed_tasks": completed_count,
        "completion_rate": completion_rate,
        "total_active_hours": round(total_active_hours, 2),
        "current_load": current_load,
        "availability": availability,
        "capacity_hours": capacity_hours,
        "declared_availability": declared_availability,
        "avg_quality_score": avg_quality_score,
        "on_time_rate": on_time_rate,
        "no_rework_rate": no_rework_rate,
        "overdue_active_tasks": overdue_active_tasks,
        **history_profile,
    }


def calculate_skill_match(task: Task, member: User):
    required_skills = task.required_skills or []
    if not required_skills:
        return {
            "score": 55.0,
            "matching_skills": [],
            "missing_skills": [],
            "strong_matches": 0,
            "partial_matches": 0,
            "required_count": 0,
            "matching_ratio": 0.0,
        }

    member_skills = {user_skill.skill_id: user_skill for user_skill in member.user_skills or []}

    total_score = 0.0
    matching_skills: list[str] = []
    missing_skills: list[str] = []
    strong_matches = 0
    partial_matches = 0

    for required in required_skills:
        required_level = max(required.required_level or 1, 1)
        user_skill = member_skills.get(required.skill_id)
        skill_name = required.skill.name if required.skill else f"skill_{required.skill_id}"

        if not user_skill:
            missing_skills.append(skill_name)
            continue

        user_level = max(user_skill.level or 0, 0)
        coverage = min(user_level / required_level, 1.0) * 100
        experience_bonus = min(_to_float(user_skill.years_experience) * 4, 12)
        verified_bonus = 4 if user_skill.verified_by_leader else 0
        skill_points = _clamp(coverage + experience_bonus + verified_bonus)
        total_score += skill_points

        matching_skills.append(skill_name)
        if user_level >= required_level:
            strong_matches += 1
        else:
            partial_matches += 1

    score = round(total_score / len(required_skills), 2)
    matching_ratio = round((len(matching_skills) / len(required_skills)), 4) if required_skills else 0.0

    return {
        "score": score,
        "matching_skills": matching_skills,
        "missing_skills": missing_skills,
        "strong_matches": strong_matches,
        "partial_matches": partial_matches,
        "required_count": len(required_skills),
        "matching_ratio": matching_ratio,
    }


def calculate_component_scores(task: Task, metrics: dict, skill_match: dict):
    active_tasks = metrics["active_tasks"]
    workload_score = _clamp((100 - metrics["current_load"]) * 0.8 + max(0, 100 - active_tasks * 12) * 0.2)
    availability_score = _clamp(metrics["availability"])

    quality_component = metrics["avg_quality_score"] * 20 if metrics["avg_quality_score"] > 0 else 60
    on_time_component = metrics.get("on_time_rate", 0)
    no_rework_component = metrics.get("no_rework_rate", 100)
    historical_success_rate = metrics.get("historical_success_rate", 50)
    recent_5_success_rate = metrics.get("recent_5_success_rate", historical_success_rate)
    same_task_type_success_rate = metrics.get("same_task_type_success_rate", historical_success_rate)

    performance_score = _clamp(
        metrics["completion_rate"] * 0.20
        + quality_component * 0.18
        + on_time_component * 0.18
        + no_rework_component * 0.14
        + historical_success_rate * 0.16
        + recent_5_success_rate * 0.08
        + same_task_type_success_rate * 0.06
    )

    skill_match_score = _clamp(skill_match["score"])

    return {
        "workload_score": round(workload_score, 2),
        "availability_score": round(availability_score, 2),
        "performance_score": round(performance_score, 2),
        "skill_match_score": round(skill_match_score, 2),
    }


def _fit_priority(skill_match: dict) -> int:
    required_count = int(skill_match.get("required_count", 0) or 0)
    strong_matches = int(skill_match.get("strong_matches", 0) or 0)
    matching_count = int(len(skill_match.get("matching_skills", [])))

    if required_count <= 0:
        return 1
    if strong_matches >= required_count:
        return 3
    if matching_count > 0:
        return 2
    return 0


def _operation_state(metrics: dict, strategy: str) -> str:
    rules = FEASIBILITY_RULES.get(strategy, FEASIBILITY_RULES["balance"])
    availability = float(metrics["availability"])
    current_load = float(metrics["current_load"])

    if availability <= 10 or current_load >= 95:
        return "critical"

    if availability < rules["min_availability"] or current_load > rules["max_load"]:
        return "stressed"

    return "feasible"


def _operation_priority(operation_state: str) -> int:
    if operation_state == "feasible":
        return 3
    if operation_state == "stressed":
        return 2
    return 1


def _build_pool_context(raw_items: list[dict[str, Any]], strategy: str) -> dict[str, Any]:
    has_exact_fit = any(item["fit_priority"] == 3 for item in raw_items)
    has_partial_fit = any(item["fit_priority"] >= 2 for item in raw_items)

    has_feasible_exact_fit = False
    has_feasible_partial_fit = False
    has_member_feasible = False
    has_member_feasible_exact_fit = False

    for item in raw_items:
        member = item["member"]
        role_name = _role_name(member)
        operation_state = _operation_state(item["metrics"], strategy)
        feasible = operation_state == "feasible"

        if feasible and item["fit_priority"] == 3:
            has_feasible_exact_fit = True

        if feasible and item["fit_priority"] >= 2:
            has_feasible_partial_fit = True

        if feasible and role_name == "member":
            has_member_feasible = True

        if feasible and role_name == "member" and item["fit_priority"] == 3:
            has_member_feasible_exact_fit = True

    return {
        "has_exact_fit": has_exact_fit,
        "has_partial_fit": has_partial_fit,
        "has_feasible_exact_fit": has_feasible_exact_fit,
        "has_feasible_partial_fit": has_feasible_partial_fit,
        "has_member_feasible": has_member_feasible,
        "has_member_feasible_exact_fit": has_member_feasible_exact_fit,
    }


def calculate_score(task: Task, metrics: dict, skill_match: dict, strategy: str):
    components = calculate_component_scores(task, metrics, skill_match)

    workload_score = components["workload_score"]
    availability_score = components["availability_score"]
    performance_score = components["performance_score"]
    skill_match_score = components["skill_match_score"]

    if strategy == "efficiency":
        score = (
            skill_match_score * 0.38
            + performance_score * 0.30
            + availability_score * 0.16
            + workload_score * 0.16
        )

    elif strategy == "urgency":
        score = (
            availability_score * 0.30
            + workload_score * 0.22
            + skill_match_score * 0.29
            + performance_score * 0.19
        )
        if task.priority in {"high", "critical"} and availability_score >= 65:
            score += 4

    elif strategy == "learning":
        if skill_match["required_count"] == 0:
            learning_fit = 70
        elif skill_match_score >= 85:
            learning_fit = 62
        elif skill_match_score >= 60:
            learning_fit = 88
        elif skill_match_score >= 40 and task.complexity <= 3:
            learning_fit = 82
        else:
            learning_fit = 34

        if metrics.get("same_task_type_history_count", 0) >= 1 and metrics.get("same_task_type_success_rate", 50) >= 70:
            learning_fit += 4

        score = (
            availability_score * 0.20
            + workload_score * 0.18
            + performance_score * 0.20
            + learning_fit * 0.42
        )

        if task.complexity >= 4 and skill_match_score < 60:
            score -= 12

    else:  # balance
        score = (
            skill_match_score * 0.38
            + workload_score * 0.20
            + availability_score * 0.17
            + performance_score * 0.25
        )

    if task.priority == "critical" and metrics["current_load"] > 75:
        score -= 12
    if metrics["overdue_active_tasks"] > 0:
        score -= min(metrics["overdue_active_tasks"] * 4, 12)

    return round(_clamp(score), 2), components


def _evaluate_assignability(
    *,
    task: Task,
    member: User,
    strategy: str,
    metrics: dict,
    skill_match: dict,
    pool_context: dict[str, Any],
    operation_state: str,
) -> tuple[str, list[str]]:
    reasons: list[str] = []

    role_name = _role_name(member)
    required_count = int(skill_match.get("required_count", 0) or 0)
    matching_count = int(len(skill_match.get("matching_skills", [])))
    fit_priority = _fit_priority(skill_match)

    exact_fit = fit_priority == 3
    partial_fit = fit_priority == 2
    no_fit = required_count > 0 and matching_count == 0

    if operation_state == "critical":
        reasons.append("sin capacidad operativa inmediata")
        return "not_assignable", reasons

    if strategy == "urgency":
        if no_fit:
            reasons.append("urgency exige un mínimo técnico")
            return "not_assignable", reasons
        if operation_state == "stressed":
            reasons.append("la urgencia exige mayor disponibilidad")
            return "risky", reasons

    if strategy == "efficiency":
        if no_fit:
            reasons.append("efficiency no permite asignación sin ajuste técnico")
            return "not_assignable", reasons
        if partial_fit and pool_context["has_feasible_exact_fit"]:
            reasons.append("hay perfiles técnicamente más eficientes")
            return "risky", reasons

    if strategy == "balance":
        if no_fit and pool_context["has_feasible_partial_fit"]:
            reasons.append("hay alternativas más viables con mejor ajuste")
            return "not_assignable", reasons
        if operation_state == "stressed":
            reasons.append("capacidad limitada para una asignación balanceada")
            return "risky", reasons

    if strategy == "learning":
        if no_fit and int(task.complexity or 0) >= 4:
            reasons.append("la brecha es alta para aprendizaje en esta tarea")
            return "not_assignable", reasons
        if no_fit and operation_state == "stressed":
            reasons.append("aprender con baja holgura operativa es riesgoso")
            return "not_assignable", reasons
        if partial_fit or no_fit:
            reasons.append("requeriría acompañamiento cercano")
            return "risky", reasons

    if role_name == "leader":
        if pool_context["has_member_feasible_exact_fit"] and not (exact_fit and operation_state == "feasible"):
            reasons.append("hay un integrante más apropiado que el líder")
            return "not_assignable", reasons
        if pool_context["has_member_feasible"]:
            reasons.append("el líder debería quedar como respaldo")
            return "risky", reasons

    if operation_state == "stressed":
        reasons.append("se puede asignar, pero con carga ajustada")
        return "risky", reasons

    return "assignable", reasons


def _apply_business_guardrails(
    *,
    task: Task,
    member: User,
    strategy: str,
    base_score: float,
    metrics: dict,
    skill_match: dict,
    pool_context: dict[str, Any],
) -> tuple[float, list[str], str, str]:
    adjusted = float(base_score)
    notes: list[str] = []

    role_name = _role_name(member)
    is_leader = role_name == "leader"

    required_count = int(skill_match.get("required_count", 0) or 0)
    matching_count = int(len(skill_match.get("matching_skills", [])))
    fit_priority = _fit_priority(skill_match)

    exact_fit = fit_priority == 3
    partial_fit = fit_priority == 2
    no_fit = required_count > 0 and matching_count == 0

    high_priority = task.priority in {"high", "critical"}
    high_complexity = int(task.complexity or 0) >= 4
    operation_state = _operation_state(metrics, strategy)

    same_task_type_count = int(metrics.get("same_task_type_history_count", 0) or 0)
    same_task_type_success_rate = float(metrics.get("same_task_type_success_rate", 50) or 50)
    recent_5_success_rate = float(metrics.get("recent_5_success_rate", 50) or 50)

    if strategy == "balance":
        if exact_fit:
            adjusted += 8
            notes.append("fuerte ajuste técnico frente a los requisitos")
        elif partial_fit:
            adjusted += 3
        elif no_fit:
            adjusted -= 14
            notes.append("no cubre habilidades clave de la tarea")

        if pool_context["has_feasible_exact_fit"] and not (exact_fit and operation_state == "feasible"):
            adjusted -= 8 if partial_fit else 12
            if partial_fit:
                notes.append("queda por debajo de perfiles viables con ajuste técnico completo")
            else:
                notes.append("se penalizó por falta de ajuste técnico frente a opciones viables")

    elif strategy == "efficiency":
        if exact_fit:
            adjusted += 10
            notes.append("ajuste técnico alto para una asignación eficiente")
        elif partial_fit:
            adjusted += 4
        elif no_fit:
            adjusted -= 18
            notes.append("el ajuste técnico es insuficiente para priorizar eficiencia")

        if pool_context["has_feasible_exact_fit"] and not (exact_fit and operation_state == "feasible"):
            adjusted -= 10 if partial_fit else 16

    elif strategy == "urgency":
        if exact_fit:
            adjusted += 5
        elif partial_fit:
            adjusted += 2
        elif no_fit:
            urgency_penalty = 10 if not high_priority and not high_complexity else 16
            adjusted -= urgency_penalty
            notes.append("en urgencia también se exige un mínimo de ajuste técnico")

        if pool_context["has_feasible_partial_fit"] and operation_state != "feasible":
            adjusted -= 10

    elif strategy == "learning":
        if exact_fit:
            adjusted += 2
        elif partial_fit:
            adjusted += 6 if int(task.complexity or 0) <= 3 else 3
            notes.append("tiene base técnica suficiente para crecer con acompañamiento")
        elif no_fit:
            learning_penalty = 8 if int(task.complexity or 0) <= 2 else 14
            adjusted -= learning_penalty
            notes.append("la curva de aprendizaje sería alta para esta tarea")

    if same_task_type_count >= 2:
        if same_task_type_success_rate >= 75:
            adjusted += 4
            notes.append("tiene buen antecedente en tareas similares")
        elif same_task_type_success_rate < 45:
            adjusted -= 4
            notes.append("su historial en tareas similares es limitado")

    if recent_5_success_rate >= 80:
        adjusted += 2
    elif recent_5_success_rate < 45 and metrics.get("historical_tasks_with_outcome", 0) >= 5:
        adjusted -= 2

    if operation_state == "critical":
        if strategy == "urgency":
            adjusted -= 24
            adjusted = min(adjusted, 28 if exact_fit else 18)
        elif strategy == "efficiency":
            adjusted -= 22
            adjusted = min(adjusted, 38 if exact_fit else 22)
        elif strategy == "balance":
            adjusted -= 20
            adjusted = min(adjusted, 40 if exact_fit else 24)
        else:
            adjusted -= 10
            adjusted = min(adjusted, 46 if (exact_fit or partial_fit) else 22)

        notes.append("operativamente está muy cargado para asumir una nueva tarea")

    elif operation_state == "stressed":
        if strategy == "urgency":
            adjusted -= 14
            adjusted = min(adjusted, 48 if exact_fit else 32)
        elif strategy == "efficiency":
            adjusted -= 12
            adjusted = min(adjusted, 56 if exact_fit else 38)
        elif strategy == "balance":
            adjusted -= 10
            adjusted = min(adjusted, 58 if exact_fit else 40)
        else:
            adjusted -= 4
            adjusted = min(adjusted, 58 if (exact_fit or partial_fit) else 32)

        notes.append("su disponibilidad actual es limitada para absorber trabajo adicional")

    if is_leader:
        if strategy == "urgency":
            adjusted -= 12
        elif strategy == "efficiency":
            adjusted -= 10
        elif strategy == "balance":
            adjusted -= 8
        else:
            adjusted -= 4

        if pool_context["has_member_feasible"]:
            adjusted -= 6
            notes.append("hay integrantes del equipo más apropiados operativamente que el líder")
        else:
            notes.append("al ser líder, solo conviene asignarlo si no hay alternativa mejor")

    if pool_context["has_member_feasible_exact_fit"] and is_leader and not (exact_fit and operation_state == "feasible"):
        adjusted -= 8

    if high_priority and no_fit:
        adjusted -= 6

    if high_complexity and no_fit:
        adjusted -= 6

    if metrics["availability"] <= 0 and required_count > 0:
        adjusted -= 4

    assignability_status, assignability_reasons = _evaluate_assignability(
        task=task,
        member=member,
        strategy=strategy,
        metrics=metrics,
        skill_match=skill_match,
        pool_context=pool_context,
        operation_state=operation_state,
    )

    if assignability_status == "not_assignable":
        adjusted = min(adjusted, 22 if exact_fit else 16)
    elif assignability_status == "risky":
        adjusted = min(adjusted, 58 if exact_fit else 42)

    notes.extend(assignability_reasons)

    return round(_clamp(adjusted), 2), notes, operation_state, assignability_status


def calculate_risk(task: Task, metrics: dict, skill_match: dict, strategy: str):
    required_count = int(skill_match.get("required_count", 0) or 0)
    matching_count = int(len(skill_match.get("matching_skills", [])))

    if metrics["availability"] <= 10 or metrics["current_load"] >= 95:
        return "high"
    if task.priority == "critical" and metrics["current_load"] > 80:
        return "high"
    if required_count > 0 and matching_count == 0 and task.complexity >= 3:
        return "high"
    if required_count > 0 and skill_match["score"] < 40 and task.complexity >= 4:
        return "high"
    if metrics["availability"] < 25:
        return "high"

    if strategy == "learning" and task.complexity >= 4 and skill_match["score"] < 70:
        return "medium"
    if required_count > 0 and skill_match["score"] < 65:
        return "medium"
    if metrics["current_load"] > 60 or metrics["availability"] < 45:
        return "medium"
    if metrics["overdue_active_tasks"] > 0:
        return "medium"

    return "low"


def build_reason(
    task: Task,
    metrics: dict,
    skill_match: dict,
    strategy: str,
    assignability_status: str,
    extra_notes: list[str] | None = None,
    segment_note: str | None = None,
):
    parts: list[str] = [f"estado de asignación: {_assignability_label(assignability_status).lower()}"]

    if skill_match["required_count"] > 0:
        if skill_match["matching_skills"]:
            parts.append(
                "coincidencia con habilidades requeridas: " + ", ".join(skill_match["matching_skills"][:3])
            )
        if skill_match["missing_skills"]:
            parts.append(
                "brechas detectadas en: " + ", ".join(skill_match["missing_skills"][:2])
            )
    else:
        parts.append("no hay habilidades requeridas registradas, se priorizó capacidad operativa")

    if metrics["availability"] >= 70:
        parts.append(f"alta disponibilidad ({metrics['availability']}%)")
    elif metrics["availability"] >= 45:
        parts.append(f"disponibilidad aceptable ({metrics['availability']}%)")
    else:
        parts.append(f"disponibilidad limitada ({metrics['availability']}%)")

    if metrics["current_load"] <= 35:
        parts.append(f"carga controlada ({metrics['current_load']}%)")
    elif metrics["current_load"] <= 65:
        parts.append(f"carga equilibrada ({metrics['current_load']}%)")
    else:
        parts.append(f"carga alta ({metrics['current_load']}%)")

    if metrics.get("same_task_type_history_count", 0) >= 2:
        parts.append(
            f"experiencia previa en tareas similares ({metrics['same_task_type_success_rate']}% de éxito)"
        )

    if strategy == "efficiency":
        parts.append("la estrategia prioriza rendimiento y ajuste técnico")
    elif strategy == "urgency":
        parts.append("la estrategia prioriza respuesta rápida")
    elif strategy == "learning":
        parts.append("la estrategia evalúa potencial de aprendizaje sin perder viabilidad")
    else:
        parts.append("la estrategia busca equilibrio entre capacidad, habilidades y desempeño")

    if extra_notes:
        deduped = []
        for note in extra_notes:
            if note not in deduped:
                deduped.append(note)
        parts.extend(deduped[:3])

    if segment_note and segment_note not in parts:
        parts.append(segment_note)

    return "Se recomienda porque presenta " + "; ".join(parts) + "."


def project_member_projection(task: Task, metrics: dict):
    estimated_hours_impact = _to_float(task.estimated_hours)
    projected_total_active_hours = metrics["total_active_hours"] + estimated_hours_impact
    capacity_hours = metrics["capacity_hours"] or 40.0
    projected_load = round(_clamp((projected_total_active_hours / capacity_hours) * 100), 2)
    projected_availability = round(
        min(metrics["declared_availability"], max(100 - projected_load, 0)),
        2,
    )

    return {
        **metrics,
        "active_tasks": metrics["active_tasks"] + 1,
        "total_active_hours": round(projected_total_active_hours, 2),
        "current_load": projected_load,
        "availability": projected_availability,
        "estimated_hours_impact": round(estimated_hours_impact, 2),
    }


def build_assignment_snapshot_data(db: Session, task: Task, assigned_user_id: int, strategy: str | None = None):
    user = (
        db.query(User)
        .options(
            joinedload(User.global_role),
            joinedload(User.user_skills).joinedload(UserSkill.skill),
            joinedload(User.project_memberships),
        )
        .filter(User.id == assigned_user_id, User.is_active.is_(True))
        .first()
    )

    if not user:
        return None

    project_membership = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == task.project_id,
            ProjectMember.user_id == assigned_user_id,
        )
        .first()
    )

    if not project_membership:
        return None

    metrics = calculate_member_metrics(db, user, project_membership, task)
    skill_match = calculate_skill_match(task, user)

    chosen_strategy = strategy if strategy in ALLOWED_STRATEGIES else "balance"
    calculated_score, calculated_components = calculate_score(task, metrics, skill_match, chosen_strategy)

    pool_context = {
        "has_exact_fit": False,
        "has_partial_fit": False,
        "has_feasible_exact_fit": False,
        "has_feasible_partial_fit": False,
        "has_member_feasible": False,
        "has_member_feasible_exact_fit": False,
    }
    adjusted_score, guardrail_notes, _, assignability_status = _apply_business_guardrails(
        task=task,
        member=user,
        strategy=chosen_strategy,
        base_score=calculated_score,
        metrics=metrics,
        skill_match=skill_match,
        pool_context=pool_context,
    )

    calculated_risk = calculate_risk(task, metrics, skill_match, chosen_strategy)

    recommendation_query = db.query(Recommendation).filter(
        Recommendation.task_id == task.id,
        Recommendation.recommended_user_id == assigned_user_id,
    )

    if strategy:
        recommendation_query = recommendation_query.filter(Recommendation.strategy == strategy)

    latest_recommendation = recommendation_query.order_by(Recommendation.created_at.desc()).first()

    return {
        "workload_score": (
            float(latest_recommendation.workload_score)
            if latest_recommendation and latest_recommendation.workload_score is not None
            else calculated_components["workload_score"]
        ),
        "skill_match_score": (
            float(latest_recommendation.skill_match_score)
            if latest_recommendation and latest_recommendation.skill_match_score is not None
            else calculated_components["skill_match_score"]
        ),
        "availability_score": (
            float(latest_recommendation.availability_score)
            if latest_recommendation and latest_recommendation.availability_score is not None
            else calculated_components["availability_score"]
        ),
        "performance_score": (
            float(latest_recommendation.performance_score)
            if latest_recommendation and latest_recommendation.performance_score is not None
            else calculated_components["performance_score"]
        ),
        "current_load_snapshot": float(metrics["current_load"]),
        "availability_snapshot": float(metrics["availability"]),
        "active_tasks_snapshot": int(metrics["active_tasks"]),
        "required_skills_count": int(skill_match["required_count"]),
        "matching_skills_count": int(len(skill_match["matching_skills"])),
        "estimated_hours_snapshot": float(task.estimated_hours) if task.estimated_hours is not None else None,
        "priority_snapshot": task.priority,
        "complexity_snapshot": task.complexity,
        "recommendation_score": (
            float(latest_recommendation.score)
            if latest_recommendation and latest_recommendation.score is not None
            else float(adjusted_score)
        ),
        "risk_level": latest_recommendation.risk_level if latest_recommendation else calculated_risk,
        "guardrail_notes": guardrail_notes,
        "assignability_status": assignability_status,
    }


def _compute_model_weight() -> float:
    status = get_baseline_status()
    metadata = status.get("metadata") or {}
    metrics = metadata.get("metrics") or {}

    accuracy = _to_float(metrics.get("accuracy"), 0.0)
    f1 = _to_float(metrics.get("f1"), 0.0)
    roc_auc = _to_float(metrics.get("roc_auc"), 0.0)

    readiness_score = (accuracy * 0.18) + (f1 * 0.34) + (roc_auc * 0.48)

    if readiness_score >= 0.82:
        return 0.34
    if readiness_score >= 0.75:
        return 0.30
    if readiness_score >= 0.70:
        return 0.24
    return 0.18


def _build_hybrid_evaluation(
    *,
    task: Task,
    member: User,
    strategy: str,
    heuristic_score: float,
    metrics: dict,
    skill_match: dict,
    components: dict,
    model,
    baseline_metadata: dict[str, Any] | None,
    mode: str,
    operation_state: str,
    assignability_status: str,
):
    required_skills_count = int(skill_match.get("required_count", 0) or 0)
    matching_skills_count = int(len(skill_match.get("matching_skills", [])))
    matching_ratio = float(skill_match.get("matching_ratio", 0.0) or 0.0)
    role_name = _role_name(member)

    if mode == "heuristic":
        return {
            "final_score": round(float(heuristic_score), 2),
            "heuristic_score": round(float(heuristic_score), 2),
            "ml_success_probability": None,
            "hybrid_score": None,
            "model_used": False,
            "segment_note": None,
        }

    feature_payload = build_feature_payload(
        source="recommended",
        strategy=strategy,
        priority_snapshot=task.priority,
        task_type_snapshot=task.task_type or "other",
        snapshot_quality="live_member_profile",
        recommendation_score=float(heuristic_score),
        workload_score=float(components["workload_score"]),
        skill_match_score=float(components["skill_match_score"]),
        availability_score=float(components["availability_score"]),
        performance_score=float(components["performance_score"]),
        current_load_snapshot=float(metrics["current_load"]),
        availability_snapshot=float(metrics["availability"]),
        active_tasks_snapshot=int(metrics["active_tasks"]),
        required_skills_count=required_skills_count,
        matching_skills_count=matching_skills_count,
        matching_ratio=matching_ratio,
        estimated_hours_snapshot=float(task.estimated_hours) if task.estimated_hours is not None else None,
        complexity_snapshot=int(task.complexity),
        historical_tasks_with_outcome=int(metrics.get("historical_tasks_with_outcome", 0) or 0),
        historical_success_rate=float(metrics.get("historical_success_rate", 50) or 50),
        historical_avg_success_score=float(metrics.get("historical_avg_success_score", 60) or 60),
        historical_on_time_rate=float(metrics.get("historical_on_time_rate", 50) or 50),
        historical_quality_index=float(metrics.get("historical_quality_index", 60) or 60),
        historical_no_rework_rate=float(metrics.get("historical_no_rework_rate", 50) or 50),
        same_task_type_history_count=int(metrics.get("same_task_type_history_count", 0) or 0),
        same_task_type_success_rate=float(metrics.get("same_task_type_success_rate", 50) or 50),
        same_priority_history_count=int(metrics.get("same_priority_history_count", 0) or 0),
        same_priority_success_rate=float(metrics.get("same_priority_success_rate", 50) or 50),
        recent_5_success_rate=float(metrics.get("recent_5_success_rate", 50) or 50),
    )

    ml_success_probability = predict_success_probability_from_features(feature_payload, model=model)
    if ml_success_probability is None:
        return {
            "final_score": round(float(heuristic_score), 2),
            "heuristic_score": round(float(heuristic_score), 2),
            "ml_success_probability": None,
            "hybrid_score": None,
            "model_used": False,
            "segment_note": None,
        }

    if required_skills_count > 0 and matching_skills_count == 0:
        if strategy in {"balance", "efficiency"}:
            ml_success_probability = min(float(ml_success_probability), 0.35)
        elif strategy == "urgency":
            ml_success_probability = min(float(ml_success_probability), 0.30)
        elif strategy == "learning" and int(task.complexity or 0) >= 4:
            ml_success_probability = min(float(ml_success_probability), 0.35)

    if operation_state == "critical":
        if strategy == "urgency":
            ml_success_probability = min(float(ml_success_probability), 0.35)
        elif strategy == "learning":
            ml_success_probability = min(float(ml_success_probability), 0.48)
        else:
            ml_success_probability = min(float(ml_success_probability), 0.50)

    elif operation_state == "stressed":
        if strategy == "urgency":
            ml_success_probability = min(float(ml_success_probability), 0.55)
        else:
            ml_success_probability = min(float(ml_success_probability), 0.68)

    if role_name == "leader" and strategy in {"balance", "efficiency", "urgency"}:
        ml_success_probability = min(float(ml_success_probability), 0.58)

    if assignability_status == "not_assignable":
        ml_success_probability = min(float(ml_success_probability), 0.32)
    elif assignability_status == "risky":
        ml_success_probability = min(float(ml_success_probability), 0.62)

    segment_penalty, segment_note = _segment_confidence_adjustment(
        baseline_metadata,
        strategy=strategy,
        task_type=task.task_type,
    )
    ml_success_probability = max(0.0, float(ml_success_probability) - segment_penalty)
    strategy_threshold = _strategy_decision_threshold(baseline_metadata, strategy)

    baseline_weight = _compute_model_weight()

    if operation_state == "critical":
        baseline_weight = min(baseline_weight, 0.14)
    elif operation_state == "stressed":
        baseline_weight = min(baseline_weight, 0.20)

    if role_name == "leader" and strategy in {"balance", "efficiency", "urgency"}:
        baseline_weight = min(baseline_weight, 0.16)

    if assignability_status == "not_assignable":
        baseline_weight = min(baseline_weight, 0.10)
    elif assignability_status == "risky":
        baseline_weight = min(baseline_weight, 0.18)

    heuristic_weight = round(1 - baseline_weight, 2)

    hybrid_score = round(
        (float(heuristic_score) * heuristic_weight)
        + (float(ml_success_probability) * 100 * baseline_weight),
        2,
    )

    if float(ml_success_probability) < strategy_threshold:
        threshold_gap = strategy_threshold - float(ml_success_probability)
        hybrid_score -= min(10.0, threshold_gap * 24.0)
        if segment_note is None:
            segment_note = f"la probabilidad ML queda por debajo del umbral esperado para {strategy}"

    if assignability_status == "not_assignable":
        hybrid_score = min(hybrid_score, 18 if matching_skills_count > 0 else 14)
    elif assignability_status == "risky":
        hybrid_score = min(hybrid_score, 44 if matching_skills_count > 0 else 34)

    if operation_state == "critical":
        if strategy == "urgency":
            hybrid_score = min(hybrid_score, 24 if matching_skills_count > 0 else 18)
        elif strategy == "efficiency":
            hybrid_score = min(hybrid_score, 30 if matching_skills_count > 0 else 20)
        elif strategy == "balance":
            hybrid_score = min(hybrid_score, 32 if matching_skills_count > 0 else 22)
        else:
            hybrid_score = min(hybrid_score, 42 if matching_skills_count > 0 else 24)

    hybrid_score = round(_clamp(hybrid_score), 2)

    return {
        "final_score": round(float(hybrid_score), 2),
        "heuristic_score": round(float(heuristic_score), 2),
        "ml_success_probability": round(float(ml_success_probability), 4),
        "hybrid_score": round(float(hybrid_score), 2),
        "model_used": True,
        "segment_note": segment_note,
    }


def _serialize_candidate_summary(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "member": build_recommendation_member(item["member"]),
        "score": item["score"],
        "reason": item["reason"],
        "assignability_status": item["assignability_status"],
        "assignability_label": _assignability_label(item["assignability_status"]),
        "operation_state": item["operation_state"],
        "risk_level": item["risk_level"],
        "availability": item["metrics"]["availability"],
        "current_load": item["metrics"]["current_load"],
        "active_tasks": item["metrics"]["active_tasks"],
        "matching_skills": item["skill_match"]["matching_skills"],
        "heuristic_score": item.get("heuristic_score"),
        "ml_success_probability": item.get("ml_success_probability"),
        "hybrid_score": item.get("hybrid_score"),
        "model_used": item.get("model_used", False),
    }


def _split_candidates_by_assignability(ranked_items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    assignable = [item for item in ranked_items if item["assignability_status"] == "assignable"]
    risky = [item for item in ranked_items if item["assignability_status"] == "risky"]
    not_assignable = [item for item in ranked_items if item["assignability_status"] == "not_assignable"]

    return {
        "assignable": assignable,
        "risky": risky,
        "not_assignable": not_assignable,
    }


def _decision_summary(strategy: str, ranked_items: list[dict[str, Any]]) -> dict[str, Any]:
    buckets = _split_candidates_by_assignability(ranked_items)
    assignable = buckets["assignable"]
    risky = buckets["risky"]
    not_assignable = buckets["not_assignable"]

    if assignable:
        decision_status = "assignable_candidate_found"
        recommended_action = "assign_now"
        primary_candidate_available = True
        primary_candidate = _serialize_candidate_summary(assignable[0])
    elif risky:
        decision_status = "no_assignable_candidate"
        if strategy == "learning":
            recommended_action = "assign_with_mentoring_and_supervision"
        else:
            recommended_action = "replan_or_explicit_risk_acceptance"
        primary_candidate_available = False
        primary_candidate = None
    else:
        decision_status = "no_assignable_candidate"
        recommended_action = "replan_or_escalate"
        primary_candidate_available = False
        primary_candidate = None

    return {
        "decision_status": decision_status,
        "recommended_action": recommended_action,
        "primary_candidate_available": primary_candidate_available,
        "primary_candidate": primary_candidate,
        "assignability_summary": {
            "assignable_count": len(assignable),
            "risky_count": len(risky),
            "not_assignable_count": len(not_assignable),
        },
        "assignable_candidates": [_serialize_candidate_summary(item) for item in assignable[:5]],
        "risky_candidates": [_serialize_candidate_summary(item) for item in risky[:5]],
        "not_assignable_candidates": [_serialize_candidate_summary(item) for item in not_assignable[:5]],
    }


def _rank_members(db: Session, task: Task, strategy: str, mode: str = "hybrid"):
    raw_items: list[dict[str, Any]] = []
    baseline_model = load_baseline_model() if mode == "hybrid" else None
    baseline_metadata = load_baseline_metadata() if mode == "hybrid" else None

    for member, membership in get_eligible_project_members(task):
        metrics = calculate_member_metrics(db, member, membership, task)
        skill_match = calculate_skill_match(task, member)
        base_score, components = calculate_score(task, metrics, skill_match, strategy)

        raw_items.append(
            {
                "member": member,
                "membership": membership,
                "metrics": metrics,
                "skill_match": skill_match,
                "components": components,
                "base_score": base_score,
                "fit_priority": _fit_priority(skill_match),
            }
        )

    pool_context = _build_pool_context(raw_items, strategy)

    ranked_items: list[dict[str, Any]] = []
    for raw in raw_items:
        adjusted_score, guardrail_notes, operation_state, assignability_status = _apply_business_guardrails(
            task=task,
            member=raw["member"],
            strategy=strategy,
            base_score=raw["base_score"],
            metrics=raw["metrics"],
            skill_match=raw["skill_match"],
            pool_context=pool_context,
        )

        risk_level = calculate_risk(task, raw["metrics"], raw["skill_match"], strategy)

        hybrid_eval = _build_hybrid_evaluation(
            task=task,
            member=raw["member"],
            strategy=strategy,
            heuristic_score=adjusted_score,
            metrics=raw["metrics"],
            skill_match=raw["skill_match"],
            components=raw["components"],
            model=baseline_model,
            baseline_metadata=baseline_metadata,
            mode=mode,
            operation_state=operation_state,
            assignability_status=assignability_status,
        )

        reason = build_reason(
            task,
            raw["metrics"],
            raw["skill_match"],
            strategy,
            assignability_status,
            guardrail_notes,
            hybrid_eval.get("segment_note"),
        )

        ranked_items.append(
            {
                "member": raw["member"],
                "membership": raw["membership"],
                "metrics": raw["metrics"],
                "skill_match": raw["skill_match"],
                "score": hybrid_eval["final_score"],
                "heuristic_score": hybrid_eval["heuristic_score"],
                "ml_success_probability": hybrid_eval["ml_success_probability"],
                "hybrid_score": hybrid_eval["hybrid_score"],
                "model_used": hybrid_eval["model_used"],
                "risk_level": risk_level,
                "reason": reason,
                "fit_priority": raw["fit_priority"],
                "operation_state": operation_state,
                "assignability_status": assignability_status,
                **raw["components"],
            }
        )

    ranked_items.sort(
        key=lambda item: (
            _assignability_rank(item["assignability_status"]),
            item["score"],
            _operation_priority(item["operation_state"]),
            item["fit_priority"],
            item["skill_match_score"],
            item["availability_score"],
            -item["metrics"]["current_load"],
        ),
        reverse=True,
    )
    return ranked_items


def persist_recommendations(db: Session, task: Task, strategy: str, ranked_items: list[dict[str, Any]]):
    (
        db.query(Recommendation)
        .filter(Recommendation.task_id == task.id, Recommendation.strategy == strategy)
        .delete(synchronize_session=False)
    )

    db.flush()

    next_id = None
    if _is_sqlite(db):
        next_id = _next_sqlite_pk(db, Recommendation)

    for index, item in enumerate(ranked_items[:5], start=1):
        recommendation_data = dict(
            task_id=task.id,
            recommended_user_id=item["member"].id,
            score=item["score"],
            rank_position=index,
            reason_summary=item["reason"],
            workload_score=item["workload_score"],
            skill_match_score=item["skill_match_score"],
            availability_score=item["availability_score"],
            performance_score=item["performance_score"],
            risk_level=item["risk_level"],
            strategy=strategy,
        )

        if next_id is not None:
            recommendation_data["id"] = next_id
            next_id += 1

        db.add(Recommendation(**recommendation_data))

    db.commit()


def build_task_recommendations_response(db: Session, task: Task, strategy: str, mode: str = "hybrid"):
    ranked_items = _rank_members(db, task, strategy, mode)
    if not ranked_items:
        return None

    persist_recommendations(db, task, strategy, ranked_items)

    response_items = []
    for item in ranked_items[:3]:
        response_items.append(
            TaskRecommendationItem(
                member=build_recommendation_member(item["member"]),
                score=item["score"],
                reason=item["reason"],
                availability=f"{item['metrics']['availability']}%",
                current_load=f"{item['metrics']['current_load']}%",
                risk_level=item["risk_level"],
                active_tasks=item["metrics"]["active_tasks"],
                matching_skills=item["skill_match"]["matching_skills"],
                workload_score=item["workload_score"],
                skill_match_score=item["skill_match_score"],
                availability_score=item["availability_score"],
                performance_score=item["performance_score"],
                heuristic_score=item.get("heuristic_score"),
                ml_success_probability=item.get("ml_success_probability"),
                hybrid_score=item.get("hybrid_score"),
                model_used=item.get("model_used", False),
            )
        )

    decision = _decision_summary(strategy, ranked_items)

    return {
        "task_id": task.id,
        "task_title": task.title,
        "strategy": strategy,
        "mode": mode,
        "recommendations": response_items,
        **decision,
    }


def build_task_simulation_response(db: Session, task: Task, strategy: str, mode: str = "hybrid"):
    ranked_items = _rank_members(db, task, strategy, mode)
    if not ranked_items:
        return None

    simulations = []
    for rank, item in enumerate(ranked_items[:3], start=1):
        projected_metrics = project_member_projection(task, item["metrics"])
        simulations.append(
            TaskSimulationItem(
                rank=rank,
                member=build_recommendation_member(item["member"]),
                score=item["score"],
                risk_level=item["risk_level"],
                reason=item["reason"],
                current_load=item["metrics"]["current_load"],
                projected_load=projected_metrics["current_load"],
                current_availability=item["metrics"]["availability"],
                projected_availability=projected_metrics["availability"],
                current_active_tasks=item["metrics"]["active_tasks"],
                projected_active_tasks=projected_metrics["active_tasks"],
                estimated_hours_impact=projected_metrics["estimated_hours_impact"],
                matching_skills=item["skill_match"]["matching_skills"],
                heuristic_score=item.get("heuristic_score"),
                ml_success_probability=item.get("ml_success_probability"),
                hybrid_score=item.get("hybrid_score"),
                model_used=item.get("model_used", False),
            )
        )

    decision = _decision_summary(strategy, ranked_items)

    return {
        "task_id": task.id,
        "task_title": task.title,
        "strategy": strategy,
        "mode": mode,
        "simulations": simulations,
        **decision,
    }