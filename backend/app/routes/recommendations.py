from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Task, User
from app.schemas import (
    TaskRecommendationResponse,
    TaskRecommendationItem,
    RecommendationMember,
)

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


def calculate_member_metrics(db: Session, member_id: int):
    assigned_tasks = (
        db.query(Task)
        .filter(Task.assigned_to == member_id)
        .all()
    )

    active_statuses = {"pending", "in_progress", "review", "blocked"}
    completed_statuses = {"done"}

    active_tasks = [task for task in assigned_tasks if task.status in active_statuses]
    completed_tasks = [task for task in assigned_tasks if task.status in completed_statuses]

    total_tasks = len(assigned_tasks)
    active_count = len(active_tasks)
    completed_count = len(completed_tasks)

    completion_rate = round((completed_count / total_tasks) * 100, 2) if total_tasks > 0 else 0.0

    total_active_hours = 0.0
    for task in active_tasks:
        if task.estimated_hours is not None:
            total_active_hours += float(task.estimated_hours)

    current_load = round(min((total_active_hours / 40) * 100, 100), 2)
    availability = round(max(100 - current_load, 0), 2)

    return {
        "active_tasks": active_count,
        "completed_tasks": completed_count,
        "completion_rate": completion_rate,
        "current_load": current_load,
        "availability": availability,
    }


def calculate_score(task: Task, metrics: dict, strategy: str):
    availability = metrics["availability"]
    current_load = metrics["current_load"]
    completion_rate = metrics["completion_rate"]
    active_tasks = metrics["active_tasks"]

    score = 0.0

    if strategy == "efficiency":
        score += availability * 0.25
        score += max(0, 100 - current_load) * 0.20
        score += completion_rate * 0.40
        score += max(0, 20 - (active_tasks * 5))
        if task.priority == "critical" and current_load > 60:
            score -= 15
        if task.complexity >= 4 and completion_rate < 50:
            score -= 10

    elif strategy == "urgency":
        score += availability * 0.40
        score += max(0, 100 - current_load) * 0.35
        score += completion_rate * 0.15
        score += max(0, 10 - (active_tasks * 2))
        if task.priority == "critical" and availability >= 60:
            score += 10

    elif strategy == "learning":
        score += availability * 0.35
        score += max(0, 100 - current_load) * 0.30
        score += max(0, 100 - completion_rate) * 0.15
        score += max(0, 15 - (active_tasks * 3))
        if task.complexity >= 5:
            score -= 10

    else:  # balance
        score += availability * 0.35
        score += max(0, 100 - current_load) * 0.25
        score += completion_rate * 0.20
        score += max(0, 15 - (active_tasks * 3))
        if task.priority == "critical" and current_load > 70:
            score -= 15
        elif task.priority == "critical" and current_load > 50:
            score -= 8
        if task.complexity >= 4 and completion_rate < 50:
            score -= 8

    return round(max(min(score, 100), 0), 2)


def calculate_risk(task: Task, metrics: dict, strategy: str):
    current_load = metrics["current_load"]
    availability = metrics["availability"]

    if task.priority == "critical" and current_load > 70:
        return "high"

    if task.complexity >= 4 and availability < 30:
        return "high"

    if strategy == "learning" and task.complexity >= 4:
        return "medium"

    if current_load > 60 or availability < 40:
        return "medium"

    return "low"


def build_reason(task: Task, metrics: dict, strategy: str):
    base_parts = []

    if metrics["availability"] >= 60:
        base_parts.append("alta disponibilidad")
    elif metrics["availability"] >= 40:
        base_parts.append("disponibilidad aceptable")
    else:
        base_parts.append("disponibilidad limitada")

    if metrics["current_load"] <= 30:
        base_parts.append("baja carga actual")
    elif metrics["current_load"] <= 60:
        base_parts.append("carga equilibrada")
    else:
        base_parts.append("carga elevada")

    if strategy == "efficiency":
        base_parts.append("priorización del mejor rendimiento disponible")
    elif strategy == "urgency":
        base_parts.append("orientación a respuesta rápida")
    elif strategy == "learning":
        base_parts.append("oportunidad de desarrollo para el integrante")
    else:
        base_parts.append("equilibrio entre capacidad y desempeño")

    if task.complexity >= 4:
        base_parts.append("la complejidad requiere revisar bien la capacidad disponible")

    return "Se recomienda por " + ", ".join(base_parts) + "."


@router.get("/tasks/{task_id}", response_model=TaskRecommendationResponse)
def get_task_recommendations(
    task_id: int,
    strategy: str = Query(default="balance"),
    db: Session = Depends(get_db),
):
    allowed_strategies = {"balance", "efficiency", "urgency", "learning"}
    if strategy not in allowed_strategies:
        raise HTTPException(status_code=400, detail="Estrategia no válida")

    task = (
        db.query(Task)
        .options(joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    members = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.is_active == True)
        .all()
    )

    if not members:
        raise HTTPException(status_code=404, detail="No hay integrantes disponibles para recomendar")

    recommendations = []

    for member in members:
        role_name = member.global_role.name if member.global_role else "member"
        if role_name == "admin":
            continue

        metrics = calculate_member_metrics(db, member.id)
        score = calculate_score(task, metrics, strategy)
        risk_level = calculate_risk(task, metrics, strategy)
        reason = build_reason(task, metrics, strategy)

        recommendations.append(
            TaskRecommendationItem(
                member=RecommendationMember(
                    id=member.id,
                    full_name=member.full_name,
                    email=member.email,
                    role_name=role_name,
                ),
                score=score,
                reason=reason,
                availability=f"{metrics['availability']}%",
                current_load=f"{metrics['current_load']}%",
                risk_level=risk_level,
                active_tasks=metrics["active_tasks"],
                matching_skills=[],
            )
        )

    recommendations.sort(key=lambda item: item.score, reverse=True)

    return TaskRecommendationResponse(
        task_id=task.id,
        task_title=task.title,
        strategy=strategy,
        recommendations=recommendations[:3],
    )