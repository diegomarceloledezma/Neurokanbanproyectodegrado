import unicodedata
from datetime import date

from app.models import Task

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