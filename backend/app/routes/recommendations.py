from fastapi import APIRouter, Depends, HTTPException
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


def calculate_score(task: Task, metrics: dict):
    score = 0.0

    availability = metrics["availability"]
    current_load = metrics["current_load"]
    completion_rate = metrics["completion_rate"]
    active_tasks = metrics["active_tasks"]

    # Disponibilidad y carga
    if availability >= 60:
        score += 35
    elif availability >= 40:
        score += 25
    elif availability >= 20:
        score += 15
    else:
        score += 5

    if current_load <= 30:
        score += 25
    elif current_load <= 50:
        score += 18
    elif current_load <= 70:
        score += 10
    else:
        score += 3

    # Cumplimiento histórico
    if completion_rate >= 80:
        score += 20
    elif completion_rate >= 60:
        score += 15
    elif completion_rate >= 40:
        score += 10
    else:
        score += 5

    # Penalización por exceso de tareas activas
    if active_tasks == 0:
        score += 15
    elif active_tasks <= 2:
        score += 10
    elif active_tasks <= 4:
        score += 5
    else:
        score += 0

    # Ajuste por urgencia/complejidad
    if task.priority == "critical":
        if current_load > 70:
            score -= 15
        elif current_load > 50:
            score -= 8

    if task.complexity >= 4 and completion_rate < 50:
        score -= 8

    return round(max(score, 0), 2)


def calculate_risk(task: Task, metrics: dict):
    current_load = metrics["current_load"]
    availability = metrics["availability"]

    if task.priority == "critical" and current_load > 70:
        return "high"

    if task.complexity >= 4 and availability < 30:
        return "high"

    if current_load > 60 or availability < 40:
        return "medium"

    return "low"


def build_reason(task: Task, metrics: dict):
    parts = []

    if metrics["availability"] >= 60:
        parts.append("alta disponibilidad")
    elif metrics["availability"] >= 40:
        parts.append("disponibilidad aceptable")
    else:
        parts.append("disponibilidad limitada")

    if metrics["current_load"] <= 30:
        parts.append("baja carga actual")
    elif metrics["current_load"] <= 60:
        parts.append("carga equilibrada")
    else:
        parts.append("carga elevada")

    if metrics["completion_rate"] >= 80:
        parts.append("muy buen cumplimiento")
    elif metrics["completion_rate"] >= 60:
        parts.append("cumplimiento estable")
    else:
        parts.append("cumplimiento aún en desarrollo")

    if task.priority == "critical":
        parts.append("la tarea requiere una asignación cuidadosa por su prioridad")
    elif task.complexity >= 4:
        parts.append("la complejidad exige revisar bien la capacidad disponible")

    return "Se recomienda por " + ", ".join(parts) + "."


@router.get("/tasks/{task_id}", response_model=TaskRecommendationResponse)
def get_task_recommendations(task_id: int, db: Session = Depends(get_db)):
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
        # Evitar recomendar administradores si existieran
        role_name = member.global_role.name if member.global_role else "member"
        if role_name == "admin":
            continue

        metrics = calculate_member_metrics(db, member.id)
        score = calculate_score(task, metrics)
        risk_level = calculate_risk(task, metrics)
        reason = build_reason(task, metrics)

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
        strategy="balance",
        recommendations=recommendations[:3],
    )