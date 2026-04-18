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
    load_baseline_model,
    predict_success_probability_from_features,
)

ALLOWED_STRATEGIES = {"balance", "efficiency", "urgency", "learning"}
ALLOWED_MODES = {"heuristic", "hybrid"}
HEURISTIC_WEIGHT = 0.65
BASELINE_WEIGHT = 0.35
ACTIVE_STATUSES = {"pending", "in_progress", "review", "blocked"}
COMPLETED_STATUSES = {"done"}


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(value, high))


def _is_sqlite(db: Session) -> bool:
    bind = db.get_bind()
    return bind is not None and bind.dialect.name == "sqlite"


def _next_sqlite_pk(db: Session, model) -> int:
    current_max = db.query(func.max(model.id)).scalar()
    return int(current_max or 0) + 1


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
    role_name = member.global_role.name if member.global_role else "member"
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

        role_name = member.global_role.name if member.global_role else "member"
        if role_name == "admin":
            continue

        eligible.append((member, membership))

    return eligible


def calculate_member_metrics(db: Session, member: User, project_membership: ProjectMember):
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
            (
                sum(1 for row in on_time_rows if row.finished_on_time)
                / len(on_time_rows)
            )
            * 100,
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
            (
                sum(1 for row in rework_rows if not row.had_rework)
                / len(rework_rows)
            )
            * 100,
            2,
        )

    overdue_active_tasks = 0
    today = date.today()
    for task in active_tasks:
        if task.due_date and task.due_date < today:
            overdue_active_tasks += 1

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

    return {
        "score": score,
        "matching_skills": matching_skills,
        "missing_skills": missing_skills,
        "strong_matches": strong_matches,
        "partial_matches": partial_matches,
        "required_count": len(required_skills),
    }


def calculate_component_scores(task: Task, metrics: dict, skill_match: dict):
    active_tasks = metrics["active_tasks"]
    workload_score = _clamp((100 - metrics["current_load"]) * 0.8 + max(0, 100 - active_tasks * 12) * 0.2)
    availability_score = _clamp(metrics["availability"])

    quality_component = metrics["avg_quality_score"] * 20 if metrics["avg_quality_score"] > 0 else 60
    on_time_component = metrics.get("on_time_rate", 0)
    no_rework_component = metrics.get("no_rework_rate", 100)

    performance_score = _clamp(
        metrics["completion_rate"] * 0.40
        + quality_component * 0.25
        + on_time_component * 0.20
        + no_rework_component * 0.15
    )

    skill_match_score = _clamp(skill_match["score"])

    return {
        "workload_score": round(workload_score, 2),
        "availability_score": round(availability_score, 2),
        "performance_score": round(performance_score, 2),
        "skill_match_score": round(skill_match_score, 2),
    }


def calculate_score(task: Task, metrics: dict, skill_match: dict, strategy: str):
    components = calculate_component_scores(task, metrics, skill_match)

    workload_score = components["workload_score"]
    availability_score = components["availability_score"]
    performance_score = components["performance_score"]
    skill_match_score = components["skill_match_score"]

    if strategy == "efficiency":
        score = (
            skill_match_score * 0.35
            + performance_score * 0.30
            + availability_score * 0.20
            + workload_score * 0.15
        )

    elif strategy == "urgency":
        score = (
            availability_score * 0.30
            + workload_score * 0.25
            + skill_match_score * 0.30
            + performance_score * 0.15
        )
        if task.priority in {"high", "critical"} and availability_score >= 65:
            score += 5

    elif strategy == "learning":
        if skill_match["required_count"] == 0:
            learning_fit = 70
        elif skill_match_score >= 85:
            learning_fit = 65
        elif skill_match_score >= 60:
            learning_fit = 90
        elif skill_match_score >= 40 and task.complexity <= 3:
            learning_fit = 80
        else:
            learning_fit = 35

        score = (
            availability_score * 0.20
            + workload_score * 0.20
            + performance_score * 0.15
            + learning_fit * 0.45
        )

        if task.complexity >= 4 and skill_match_score < 60:
            score -= 12

    else:  # balance
        score = (
            skill_match_score * 0.35
            + workload_score * 0.25
            + availability_score * 0.20
            + performance_score * 0.20
        )

    if task.priority == "critical" and metrics["current_load"] > 75:
        score -= 12
    if metrics["overdue_active_tasks"] > 0:
        score -= min(metrics["overdue_active_tasks"] * 4, 12)

    return round(_clamp(score), 2), components


def calculate_risk(task: Task, metrics: dict, skill_match: dict, strategy: str):
    if task.priority == "critical" and metrics["current_load"] > 80:
        return "high"
    if skill_match["required_count"] > 0 and skill_match["score"] < 40 and task.complexity >= 4:
        return "high"
    if metrics["availability"] < 25:
        return "high"

    if strategy == "learning" and task.complexity >= 4 and skill_match["score"] < 70:
        return "medium"
    if skill_match["required_count"] > 0 and skill_match["score"] < 65:
        return "medium"
    if metrics["current_load"] > 60 or metrics["availability"] < 45:
        return "medium"
    if metrics["overdue_active_tasks"] > 0:
        return "medium"

    return "low"


def build_reason(task: Task, metrics: dict, skill_match: dict, strategy: str):
    parts: list[str] = []

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

    if strategy == "efficiency":
        parts.append("la estrategia prioriza rendimiento y ajuste técnico")
    elif strategy == "urgency":
        parts.append("la estrategia prioriza respuesta rápida")
    elif strategy == "learning":
        parts.append("la estrategia evalúa potencial de aprendizaje sin perder viabilidad")
    else:
        parts.append("la estrategia busca equilibrio entre capacidad, habilidades y desempeño")

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

    metrics = calculate_member_metrics(db, user, project_membership)
    skill_match = calculate_skill_match(task, user)

    chosen_strategy = strategy if strategy in ALLOWED_STRATEGIES else "balance"
    calculated_score, calculated_components = calculate_score(task, metrics, skill_match, chosen_strategy)
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
            else float(calculated_score)
        ),
        "risk_level": latest_recommendation.risk_level if latest_recommendation else calculated_risk,
    }




def _build_hybrid_evaluation(
    *,
    task: Task,
    strategy: str,
    heuristic_score: float,
    metrics: dict,
    skill_match: dict,
    components: dict,
    model,
    mode: str,
):
    required_skills_count = int(skill_match.get("required_count", 0) or 0)
    matching_skills_count = int(len(skill_match.get("matching_skills", [])))
    matching_ratio = round((matching_skills_count / required_skills_count) * 100, 2) if required_skills_count > 0 else 0.0

    if mode == "heuristic":
        return {
            "final_score": round(float(heuristic_score), 2),
            "heuristic_score": round(float(heuristic_score), 2),
            "ml_success_probability": None,
            "hybrid_score": None,
            "model_used": False,
        }

    feature_payload = build_feature_payload(
        source="recommended",
        strategy=strategy,
        priority_snapshot=task.priority,
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
    )

    ml_success_probability = predict_success_probability_from_features(feature_payload, model=model)
    if ml_success_probability is None:
        return {
            "final_score": round(float(heuristic_score), 2),
            "heuristic_score": round(float(heuristic_score), 2),
            "ml_success_probability": None,
            "hybrid_score": None,
            "model_used": False,
        }

    hybrid_score = round(
        (float(heuristic_score) * HEURISTIC_WEIGHT) + (float(ml_success_probability) * 100 * BASELINE_WEIGHT),
        2,
    )

    return {
        "final_score": hybrid_score,
        "heuristic_score": round(float(heuristic_score), 2),
        "ml_success_probability": round(float(ml_success_probability), 4),
        "hybrid_score": hybrid_score,
        "model_used": True,
    }

def _rank_members(db: Session, task: Task, strategy: str, mode: str = "hybrid"):
    ranked_items: list[dict[str, Any]] = []
    baseline_model = load_baseline_model() if mode == "hybrid" else None

    for member, membership in get_eligible_project_members(task):
        metrics = calculate_member_metrics(db, member, membership)
        skill_match = calculate_skill_match(task, member)
        heuristic_score, components = calculate_score(task, metrics, skill_match, strategy)
        risk_level = calculate_risk(task, metrics, skill_match, strategy)
        reason = build_reason(task, metrics, skill_match, strategy)

        hybrid_eval = _build_hybrid_evaluation(
            task=task,
            strategy=strategy,
            heuristic_score=heuristic_score,
            metrics=metrics,
            skill_match=skill_match,
            components=components,
            model=baseline_model,
            mode=mode,
        )

        ranked_items.append(
            {
                "member": member,
                "membership": membership,
                "metrics": metrics,
                "skill_match": skill_match,
                "score": hybrid_eval["final_score"],
                "heuristic_score": hybrid_eval["heuristic_score"],
                "ml_success_probability": hybrid_eval["ml_success_probability"],
                "hybrid_score": hybrid_eval["hybrid_score"],
                "model_used": hybrid_eval["model_used"],
                "risk_level": risk_level,
                "reason": reason,
                **components,
            }
        )

    ranked_items.sort(key=lambda item: item["score"], reverse=True)
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

    return TaskRecommendationResponse(
        task_id=task.id,
        task_title=task.title,
        strategy=strategy,
        mode=mode,
        recommendations=response_items,
    )


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

    return TaskSimulationResponse(
        task_id=task.id,
        task_title=task.title,
        strategy=strategy,
        mode=mode,
        simulations=simulations,
    )