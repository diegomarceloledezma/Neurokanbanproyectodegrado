import unicodedata
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Task, User
from app.schemas import (
    TaskRecommendationResponse,
    TaskRecommendationItem,
    RecommendationMember,
    TaskSimulationItem,
    TaskSimulationResponse,
    TaskInsightResponse,
)

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


STRATEGY_LABELS = {
    "balance": "Balance",
    "efficiency": "Eficiencia",
    "urgency": "Urgencia",
    "learning": "Aprendizaje",
}


AREA_KEYWORDS = {
    "Tecnología": [
        "base de datos",
        "database",
        "sql",
        "api",
        "backend",
        "frontend",
        "sistema",
        "modelo",
        "modelado",
        "arquitectura",
        "codigo",
        "código",
        "integracion",
        "integración",
        "software",
        "desarrollo",
        "deploy",
        "infraestructura",
        "bug",
    ],
    "Diseño": [
        "diseno",
        "diseño",
        "grafico",
        "gráfico",
        "ui",
        "ux",
        "wireframe",
        "prototipo",
        "prototipado",
        "visual",
        "branding",
        "identidad visual",
        "maquetacion",
        "maquetación",
        "creativo",
    ],
    "Marketing": [
        "campana",
        "campaña",
        "marketing",
        "promocion",
        "promoción",
        "segmentacion",
        "segmentación",
        "leads",
        "conversion",
        "conversión",
        "publicidad",
        "anuncio",
        "contenido comercial",
        "embudo",
    ],
    "Comunicación": [
        "comunicacion",
        "comunicación",
        "redaccion",
        "redacción",
        "copy",
        "nota de prensa",
        "mensaje",
        "difusion",
        "difusión",
        "redes sociales",
        "instagram",
        "tiktok",
        "publicacion",
        "publicación",
        "comunidad",
    ],
    "Administración": [
        "presupuesto",
        "cotizacion",
        "cotización",
        "factura",
        "finanzas",
        "gestion",
        "gestión",
        "administrativo",
        "documentacion",
        "documentación",
        "reporte",
        "planificacion",
        "planificación",
        "coordinacion",
        "coordinación",
    ],
    "Operaciones": [
        "logistica",
        "logística",
        "operacion",
        "operación",
        "seguimiento",
        "implementacion",
        "implementación",
        "ejecucion",
        "ejecución",
        "flujo",
        "proceso",
        "entrega",
    ],
    "Investigación": [
        "investigacion",
        "investigación",
        "analisis",
        "análisis",
        "levantamiento",
        "benchmark",
        "diagnostico",
        "diagnóstico",
        "estudio",
        "evaluacion",
        "evaluación",
        "hallazgos",
        "evidencia",
    ],
}


SKILL_KEYWORDS = {
    "modelado de datos": ["base de datos", "modelo", "modelado", "entidad", "relacion", "relación", "sql"],
    "análisis estructural": ["analisis", "análisis", "estructura", "arquitectura", "levantamiento"],
    "documentación técnica": ["documentacion", "documentación", "reporte tecnico", "técnico", "especificacion", "especificación"],
    "diseño visual": ["diseno", "diseño", "grafico", "gráfico", "visual", "branding"],
    "prototipado": ["wireframe", "prototipo", "prototipado", "ui", "ux"],
    "redacción estratégica": ["copy", "mensaje", "redaccion", "redacción", "nota de prensa"],
    "gestión de campañas": ["campana", "campaña", "publicidad", "segmentacion", "segmentación"],
    "planificación": ["planificacion", "planificación", "cronograma", "seguimiento"],
    "coordinación": ["coordinacion", "coordinación", "logistica", "logística", "operacion", "operación"],
    "investigación": ["investigacion", "investigación", "benchmark", "diagnostico", "diagnóstico", "hallazgos"],
}


def normalize_text(value: str | None) -> str:
    text = value or ""
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return normalized.lower()


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
        "total_active_hours": round(total_active_hours, 2),
        "current_load": current_load,
        "availability": availability,
    }


def project_member_metrics(task: Task, metrics: dict):
    estimated_hours_impact = float(task.estimated_hours or 0)
    projected_total_active_hours = metrics["total_active_hours"] + estimated_hours_impact
    projected_load = round(min((projected_total_active_hours / 40) * 100, 100), 2)
    projected_availability = round(max(100 - projected_load, 0), 2)

    projected_metrics = {
        **metrics,
        "active_tasks": metrics["active_tasks"] + 1,
        "total_active_hours": round(projected_total_active_hours, 2),
        "current_load": projected_load,
        "availability": projected_availability,
    }

    return projected_metrics


def build_recommendation_member(member: User):
    role_name = member.global_role.name if member.global_role else "member"

    return RecommendationMember(
        id=member.id,
        full_name=member.full_name,
        email=member.email,
        role_name=role_name,
    )


def get_eligible_members(db: Session):
    members = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.is_active == True)
        .all()
    )

    eligible_members = []
    for member in members:
        role_name = member.global_role.name if member.global_role else "member"
        if role_name == "admin":
            continue
        eligible_members.append(member)

    return eligible_members


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


def calculate_days_until_due(task: Task):
    if not task.due_date:
        return None
    today = date.today()
    return (task.due_date - today).days


def infer_task_insights(task: Task):
    combined_text = " ".join([
        task.title or "",
        task.description or "",
        task.task_type or "",
    ])
    normalized_text = normalize_text(combined_text)

    strategy_scores = {
        "balance": 1,
        "efficiency": 0,
        "urgency": 0,
        "learning": 0,
    }

    detected_signals = []

    if task.priority == "critical":
        strategy_scores["urgency"] += 4
        strategy_scores["efficiency"] += 1
        detected_signals.append("La prioridad de la tarea es crítica")
    elif task.priority == "high":
        strategy_scores["urgency"] += 3
        strategy_scores["efficiency"] += 1
        detected_signals.append("La prioridad de la tarea es alta")
    elif task.priority == "medium":
        strategy_scores["balance"] += 2
        detected_signals.append("La prioridad de la tarea es intermedia")
    else:
        strategy_scores["learning"] += 2
        strategy_scores["balance"] += 1
        detected_signals.append("La prioridad permite una asignación con menor presión operativa")

    if task.complexity >= 4:
        strategy_scores["efficiency"] += 3
        strategy_scores["balance"] += 1
        detected_signals.append("La complejidad de la tarea es alta")
    elif task.complexity == 3:
        strategy_scores["balance"] += 2
        detected_signals.append("La complejidad de la tarea es moderada")
    else:
        strategy_scores["learning"] += 2
        detected_signals.append("La complejidad de la tarea es adecuada para aprendizaje controlado")

    estimated_hours = float(task.estimated_hours or 0)
    if estimated_hours >= 8:
        strategy_scores["efficiency"] += 2
        detected_signals.append("La estimación de horas sugiere dedicación especializada")
    elif 0 < estimated_hours <= 4:
        strategy_scores["learning"] += 1
        strategy_scores["balance"] += 1
        detected_signals.append("La estimación de horas sugiere una carga acotada")

    days_until_due = calculate_days_until_due(task)
    if days_until_due is not None:
        if days_until_due <= 2:
            strategy_scores["urgency"] += 4
            detected_signals.append("La fecha límite está muy próxima")
        elif days_until_due <= 5:
            strategy_scores["urgency"] += 2
            detected_signals.append("La fecha límite está relativamente cercana")

    urgency_keywords = [
        "urgente",
        "inmediato",
        "incidente",
        "bloqueo",
        "crisis",
        "hoy",
        "manana",
        "campana",
        "entrega",
        "ajuste rapido",
        "respuesta rapida",
    ]
    efficiency_keywords = [
        "base de datos",
        "modelo",
        "modelado",
        "arquitectura",
        "sql",
        "api",
        "sistema",
        "documentacion tecnica",
        "backend",
        "frontend",
        "integracion",
        "precision",
    ]
    learning_keywords = [
        "apoyo",
        "borrador",
        "soporte",
        "prueba",
        "testing",
        "levantamiento",
        "investigacion",
    ]
    balance_keywords = [
        "seguimiento",
        "coordinacion",
        "gestion",
        "organizacion",
        "planificacion",
        "reunion",
    ]

    if any(keyword in normalized_text for keyword in urgency_keywords):
        strategy_scores["urgency"] += 2
        detected_signals.append("El contenido de la tarea sugiere necesidad de respuesta rápida")

    if any(keyword in normalized_text for keyword in efficiency_keywords):
        strategy_scores["efficiency"] += 2
        detected_signals.append("El tipo de tarea requiere precisión técnica o ejecución especializada")

    if any(keyword in normalized_text for keyword in learning_keywords):
        strategy_scores["learning"] += 2
        detected_signals.append("La tarea puede servir para desarrollo progresivo del integrante")

    if any(keyword in normalized_text for keyword in balance_keywords):
        strategy_scores["balance"] += 2
        detected_signals.append("La tarea encaja en una distribución equilibrada del trabajo")

    suggested_strategy = max(strategy_scores, key=strategy_scores.get)

    area_scores = {area: 0 for area in AREA_KEYWORDS.keys()}
    for area, keywords in AREA_KEYWORDS.items():
        for keyword in keywords:
            if normalize_text(keyword) in normalized_text:
                area_scores[area] += 1

    suggested_area = max(area_scores, key=area_scores.get)
    if area_scores[suggested_area] == 0:
        suggested_area = "General"

    suggested_skills = []
    for skill, keywords in SKILL_KEYWORDS.items():
        for keyword in keywords:
            if normalize_text(keyword) in normalized_text:
                suggested_skills.append(skill)
                break

    if not suggested_skills:
        fallback_by_area = {
            "Tecnología": ["análisis estructural", "documentación técnica"],
            "Diseño": ["diseño visual", "prototipado"],
            "Marketing": ["gestión de campañas", "planificación"],
            "Comunicación": ["redacción estratégica", "planificación"],
            "Administración": ["planificación", "coordinación"],
            "Operaciones": ["coordinación", "planificación"],
            "Investigación": ["investigación", "análisis estructural"],
            "General": ["planificación", "coordinación"],
        }
        suggested_skills = fallback_by_area[suggested_area]

    top_scores = sorted(strategy_scores.values(), reverse=True)
    margin = top_scores[0] - top_scores[1] if len(top_scores) > 1 else top_scores[0]

    if margin >= 3 and len(detected_signals) >= 3:
        confidence_level = "alta"
    elif margin >= 1:
        confidence_level = "media"
    else:
        confidence_level = "baja"

    suggested_strategy_label = STRATEGY_LABELS[suggested_strategy]

    explanation_map = {
        "urgency": (
            f"Se sugiere la estrategia de {suggested_strategy_label} porque la tarea muestra señales "
            "de prioridad y cercanía temporal que favorecen una asignación con respuesta rápida."
        ),
        "efficiency": (
            f"Se sugiere la estrategia de {suggested_strategy_label} porque la tarea presenta exigencia "
            "técnica o carga relevante y conviene priorizar desempeño sólido y capacidad disponible."
        ),
        "learning": (
            f"Se sugiere la estrategia de {suggested_strategy_label} porque la tarea permite desarrollo "
            "del integrante con un nivel de riesgo controlado."
        ),
        "balance": (
            f"Se sugiere la estrategia de {suggested_strategy_label} porque la tarea encaja mejor en una "
            "distribución equilibrada entre carga, disponibilidad y desempeño."
        ),
    }

    return {
        "suggested_strategy": suggested_strategy,
        "suggested_strategy_label": suggested_strategy_label,
        "suggested_area": suggested_area,
        "suggested_skills": suggested_skills[:4],
        "confidence_level": confidence_level,
        "detected_signals": detected_signals[:5],
        "explanation": explanation_map[suggested_strategy],
    }


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

    members = get_eligible_members(db)

    if not members:
        raise HTTPException(status_code=404, detail="No hay integrantes disponibles para recomendar")

    recommendations = []

    for member in members:
        metrics = calculate_member_metrics(db, member.id)
        score = calculate_score(task, metrics, strategy)
        risk_level = calculate_risk(task, metrics, strategy)
        reason = build_reason(task, metrics, strategy)

        recommendations.append(
            TaskRecommendationItem(
                member=build_recommendation_member(member),
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


@router.get("/tasks/{task_id}/simulation", response_model=TaskSimulationResponse)
def get_task_simulation(
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

    members = get_eligible_members(db)

    if not members:
        raise HTTPException(status_code=404, detail="No hay integrantes disponibles para simular")

    simulations = []

    for member in members:
        current_metrics = calculate_member_metrics(db, member.id)
        projected_metrics = project_member_metrics(task, current_metrics)
        score = calculate_score(task, projected_metrics, strategy)
        risk_level = calculate_risk(task, projected_metrics, strategy)
        reason = build_reason(task, projected_metrics, strategy)

        simulations.append(
            TaskSimulationItem(
                rank=0,
                member=build_recommendation_member(member),
                score=score,
                risk_level=risk_level,
                reason=reason,
                current_load=current_metrics["current_load"],
                projected_load=projected_metrics["current_load"],
                current_availability=current_metrics["availability"],
                projected_availability=projected_metrics["availability"],
                current_active_tasks=current_metrics["active_tasks"],
                projected_active_tasks=projected_metrics["active_tasks"],
                estimated_hours_impact=float(task.estimated_hours or 0),
            )
        )

    simulations.sort(key=lambda item: item.score, reverse=True)

    ranked_simulations = [
        TaskSimulationItem(
            rank=index,
            member=item.member,
            score=item.score,
            risk_level=item.risk_level,
            reason=item.reason,
            current_load=item.current_load,
            projected_load=item.projected_load,
            current_availability=item.current_availability,
            projected_availability=item.projected_availability,
            current_active_tasks=item.current_active_tasks,
            projected_active_tasks=item.projected_active_tasks,
            estimated_hours_impact=item.estimated_hours_impact,
        )
        for index, item in enumerate(simulations[:3], start=1)
    ]

    return TaskSimulationResponse(
        task_id=task.id,
        task_title=task.title,
        strategy=strategy,
        simulations=ranked_simulations,
    )


@router.get("/tasks/{task_id}/insights", response_model=TaskInsightResponse)
def get_task_insights(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .options(joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    insights = infer_task_insights(task)

    return TaskInsightResponse(
        task_id=task.id,
        task_title=task.title,
        suggested_strategy=insights["suggested_strategy"],
        suggested_strategy_label=insights["suggested_strategy_label"],
        suggested_area=insights["suggested_area"],
        suggested_skills=insights["suggested_skills"],
        confidence_level=insights["confidence_level"],
        detected_signals=insights["detected_signals"],
        explanation=insights["explanation"],
    )