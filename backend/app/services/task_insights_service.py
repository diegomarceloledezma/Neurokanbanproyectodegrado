from __future__ import annotations

from datetime import date
from typing import Iterable

from app.models import Task
from app.schemas import TaskInsightResponse
from app.services.skill_matching import normalize_text

STRATEGY_LABELS = {
    "balance": "Balance",
    "efficiency": "Eficiencia",
    "urgency": "Urgencia",
    "learning": "Aprendizaje",
}

TASK_TYPE_AREA_MAP = {
    "feature": "Tecnología",
    "bug": "Tecnología",
    "improvement": "Tecnología",
    "research": "Investigación y documentación",
    "documentation": "Investigación y documentación",
    "design": "Diseño UX/UI",
    "marketing": "Marketing y comunicación",
    "operations": "Gestión y operaciones",
    "other": "Multidisciplinaria",
}

CATEGORY_TO_AREA_MAP = {
    "desarrollo de software": "Tecnología",
    "base de datos": "Tecnología",
    "calidad de software": "Tecnología",
    "infraestructura": "Tecnología",
    "seguridad": "Tecnología",
    "diseno ux/ui": "Diseño UX/UI",
    "diseño ux/ui": "Diseño UX/UI",
    "diseno y comunicacion visual": "Diseño y comunicación visual",
    "diseño y comunicación visual": "Diseño y comunicación visual",
    "comunicacion y contenidos": "Marketing y comunicación",
    "comunicación y contenidos": "Marketing y comunicación",
    "marketing digital": "Marketing y comunicación",
    "investigacion y documentacion": "Investigación y documentación",
    "investigación y documentación": "Investigación y documentación",
    "analisis y negocio": "Análisis y negocio",
    "análisis y negocio": "Análisis y negocio",
    "datos": "Datos",
    "gestion y operaciones": "Gestión y operaciones",
    "gestión y operaciones": "Gestión y operaciones",
    "servicio y soporte": "Servicio y soporte",
    "habilidades transversales": "Multidisciplinaria",
}

PHRASE_AREA_RULES: list[tuple[list[str], str]] = [
    (["pantalla de login", "formulario de login", "inicio de sesion", "inicio de sesión"], "Tecnología"),
    (["modelo de base de datos", "disenar modelo de base de datos", "diseñar modelo de base de datos"], "Tecnología"),
    (["base de datos", "modelo de datos", "sql", "postgresql"], "Tecnología"),
    (["documentar flujo", "flujo de asignacion", "flujo de asignación", "trazabilidad"], "Investigación y documentación"),
    (["documentacion tecnica", "documentación técnica", "manual tecnico", "manual técnico"], "Investigación y documentación"),
    (["campana de marketing", "campaña de marketing", "redes sociales", "social media"], "Marketing y comunicación"),
]

PHRASE_SKILL_RULES: list[tuple[list[str], list[str]]] = [
    (
        ["pantalla de login", "formulario de login", "inicio de sesion", "inicio de sesión"],
        ["Seguridad de aplicaciones", "Diseño de interfaces", "Desarrollo frontend"],
    ),
    (
        ["modelo de base de datos", "disenar modelo de base de datos", "diseñar modelo de base de datos"],
        ["Modelado de datos", "Gestión de bases de datos", "Desarrollo backend"],
    ),
    (
        ["base de datos", "modelo de datos", "postgresql", "sql"],
        ["Gestión de bases de datos", "Modelado de datos", "Desarrollo backend"],
    ),
    (
        ["documentar flujo", "flujo de asignacion", "flujo de asignación", "trazabilidad"],
        ["Documentación técnica", "Investigación", "Redacción de informes", "Gestión de proyectos"],
    ),
    (
        ["documentacion tecnica", "documentación técnica", "manual tecnico", "manual técnico"],
        ["Documentación técnica", "Redacción de informes", "Investigación"],
    ),
]

KEYWORD_SKILL_RULES: list[tuple[set[str], list[str]]] = [
    ({"login", "autenticacion", "autenticación", "sesion", "sesión", "acceso"}, ["Seguridad de aplicaciones", "Diseño de interfaces", "Desarrollo frontend"]),
    ({"frontend", "react", "vista", "web"}, ["Desarrollo frontend", "Diseño de interfaces"]),
    ({"backend", "api", "endpoint", "servicio"}, ["Desarrollo backend", "Diseño de API", "Pruebas de software"]),
    ({"base de datos", "database", "sql", "modelo de datos", "postgresql"}, ["Gestión de bases de datos", "Modelado de datos", "Desarrollo backend"]),
    ({"documentacion", "documentación", "manual", "guia", "guía", "informe", "reporte", "trazabilidad"}, ["Documentación técnica", "Redacción de informes", "Investigación"]),
    ({"investigacion", "investigación", "analisis", "análisis"}, ["Investigación", "Análisis de requisitos", "Análisis de negocio"]),
    ({"marketing", "campana", "campaña", "contenido", "redes", "social media"}, ["Marketing de contenidos", "Gestión de redes sociales", "Copywriting"]),
    ({"datos", "metricas", "métricas", "dashboard", "indicadores"}, ["Análisis de datos", "Visualización de datos"]),
    ({"kanban", "scrum", "proyecto", "stakeholder", "stakeholders"}, ["Kanban", "Scrum", "Gestión de proyectos"]),
]

KEYWORD_AREA_RULES: list[tuple[set[str], str]] = [
    ({"login", "autenticacion", "autenticación", "api", "backend", "frontend", "react", "sql", "base de datos", "postgresql"}, "Tecnología"),
    ({"documentacion", "documentación", "manual", "guia", "guía", "informe", "reporte", "investigacion", "investigación", "trazabilidad"}, "Investigación y documentación"),
    ({"marketing", "redes", "social media", "contenido", "campana", "campaña"}, "Marketing y comunicación"),
    ({"datos", "metricas", "métricas", "dashboard", "indicadores"}, "Datos"),
    ({"kanban", "scrum", "stakeholders", "operacion", "operación", "coordinacion", "coordinación"}, "Gestión y operaciones"),
    ({"pantalla", "interfaz", "ui", "ux", "prototipo", "prototipado", "wireframe"}, "Diseño UX/UI"),
]


def _unique_preserve_order(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for value in values:
        key = normalize_text(value)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(value)

    return result


def _contains_any_phrase(normalized_text: str, phrases: list[str]) -> bool:
    return any(normalize_text(phrase) in normalized_text for phrase in phrases)


def _collect_task_text(task: Task) -> str:
    parts = [
        task.title or "",
        task.description or "",
        task.task_type or "",
        task.priority or "",
    ]

    required_skill_names = [
        req.skill.name
        for req in (task.required_skills or [])
        if req.skill and req.skill.name
    ]
    parts.extend(required_skill_names)

    return " ".join(parts)


def _required_skill_names(task: Task) -> list[str]:
    return [
        req.skill.name
        for req in (task.required_skills or [])
        if req.skill and req.skill.name
    ]


def _infer_area_from_required_skills(task: Task) -> str | None:
    categories: list[str] = []

    for req in task.required_skills or []:
        if req.skill and req.skill.category:
            categories.append(req.skill.category)

    normalized_categories = [normalize_text(cat) for cat in categories if cat]
    if not normalized_categories:
        return None

    unique_categories = set(normalized_categories)

    if "desarrollo de software" in unique_categories and (
        "diseno ux/ui" in unique_categories or "diseño ux/ui" in unique_categories
    ):
        return "Desarrollo y diseño de producto digital"

    if "investigacion y documentacion" in unique_categories or "investigación y documentación" in unique_categories:
        return "Investigación y documentación"

    if len(unique_categories) == 1:
        return CATEGORY_TO_AREA_MAP.get(next(iter(unique_categories)))

    category_counts: dict[str, int] = {}
    for category in normalized_categories:
        category_counts[category] = category_counts.get(category, 0) + 1

    top_category = max(category_counts.items(), key=lambda item: item[1])[0]
    return CATEGORY_TO_AREA_MAP.get(top_category)


def _infer_context_flags(task: Task, normalized_text: str) -> dict[str, bool]:
    required_names = [normalize_text(name) for name in _required_skill_names(task)]

    has_db_required = any(
        token in required_names
        for token in {"postgresql", "sql", "gestion de bases de datos", "modelado de datos", "fastapi"}
    )

    has_doc_required = any(
        token in required_names
        for token in {"documentacion", "documentación", "documentacion tecnica", "documentación técnica", "investigacion", "investigación", "redaccion", "redacción", "redaccion de informes", "redacción de informes"}
    )

    is_data_context = (
        _contains_any_phrase(normalized_text, ["modelo de base de datos", "base de datos", "modelo de datos"])
        or any(keyword in normalized_text for keyword in ["sql", "postgresql", "database"])
        or has_db_required
    )

    is_document_context = (
        _contains_any_phrase(normalized_text, ["documentar flujo", "flujo de asignacion", "flujo de asignación", "trazabilidad"])
        or any(keyword in normalized_text for keyword in ["documentacion", "documentación", "manual", "guia", "guía", "informe", "reporte", "trazabilidad"])
        or has_doc_required
        or (task.task_type in {"documentation", "research"})
    )

    is_ui_context = (
        _contains_any_phrase(normalized_text, ["pantalla de login", "formulario de login"])
        or any(keyword in normalized_text for keyword in ["pantalla", "interfaz", "ui", "ux", "formulario"])
    ) and not is_data_context and not is_document_context

    is_marketing_context = any(keyword in normalized_text for keyword in ["marketing", "campana", "campaña", "redes", "social media", "contenido"])

    is_operations_context = any(keyword in normalized_text for keyword in ["kanban", "scrum", "stakeholder", "stakeholders", "coordinacion", "coordinación"])

    return {
        "data": is_data_context,
        "document": is_document_context,
        "ui": is_ui_context,
        "marketing": is_marketing_context,
        "operations": is_operations_context,
    }


def _infer_area(task: Task, normalized_text: str, context_flags: dict[str, bool]) -> str:
    for phrases, area in PHRASE_AREA_RULES:
        if _contains_any_phrase(normalized_text, phrases):
            return area

    if context_flags["document"]:
        return "Investigación y documentación"

    if context_flags["data"]:
        return "Tecnología"

    area_from_skills = _infer_area_from_required_skills(task)
    if area_from_skills:
        return area_from_skills

    for keywords, area in KEYWORD_AREA_RULES:
        if any(keyword in normalized_text for keyword in keywords):
            return area

    return TASK_TYPE_AREA_MAP.get(task.task_type or "", "Multidisciplinaria")


def _suggest_skills(task: Task, normalized_text: str, context_flags: dict[str, bool]) -> list[str]:
    suggestions: list[str] = []
    suggestions.extend(_required_skill_names(task))

    for phrases, mapped_skills in PHRASE_SKILL_RULES:
        if _contains_any_phrase(normalized_text, phrases):
            suggestions.extend(mapped_skills)

    # Reglas por contexto fuerte
    if context_flags["data"]:
        suggestions.extend(["Gestión de bases de datos", "Modelado de datos", "Desarrollo backend"])

    if context_flags["document"]:
        suggestions.extend(["Documentación técnica", "Investigación", "Redacción de informes"])

    if context_flags["ui"]:
        suggestions.extend(["Diseño de interfaces", "Prototipado", "Desarrollo frontend"])

    if context_flags["marketing"]:
        suggestions.extend(["Marketing de contenidos", "Gestión de redes sociales", "Copywriting"])

    if context_flags["operations"]:
        suggestions.extend(["Gestión de proyectos", "Kanban", "Scrum"])

    # Reglas por keywords generales, pero evitando contaminar contextos fuertes
    for keywords, mapped_skills in KEYWORD_SKILL_RULES:
        if any(keyword in normalized_text for keyword in keywords):
            if mapped_skills == ["Diseño de interfaces", "Prototipado", "Diseño gráfico"]:
                if context_flags["data"] or context_flags["document"]:
                    continue
            suggestions.extend(mapped_skills)

    # Fallbacks solo cuando aún faltan sugerencias útiles
    if len(_unique_preserve_order(suggestions)) < 3:
        fallback_by_type = {
            "feature": ["Análisis de requisitos", "Gestión de proyectos"],
            "bug": ["Pruebas de software", "Resolución de problemas"],
            "documentation": ["Documentación técnica", "Redacción de informes"],
            "research": ["Investigación", "Análisis de negocio"],
            "design": ["Diseño de interfaces", "Prototipado"],
            "marketing": ["Marketing de contenidos", "Gestión de redes sociales"],
            "operations": ["Coordinación operativa", "Gestión de proyectos"],
        }
        suggestions.extend(fallback_by_type.get(task.task_type or "", ["Trabajo en equipo", "Planificación"]))

    unique_suggestions = _unique_preserve_order(suggestions)

    # Limpieza final de contaminación UX en contextos documentales o de datos
    if context_flags["document"] or context_flags["data"]:
        blocked_for_context = {"Diseño gráfico"}
        if not context_flags["ui"]:
            blocked_for_context.update({"Diseño de interfaces", "Prototipado"})

        unique_suggestions = [skill for skill in unique_suggestions if skill not in blocked_for_context]

    return unique_suggestions[:5]


def _days_to_due(task: Task) -> int | None:
    if not task.due_date:
        return None
    return (task.due_date - date.today()).days


def _infer_strategy(task: Task, normalized_text: str, context_flags: dict[str, bool]):
    scores = {
        "balance": 1.0,
        "efficiency": 0.0,
        "urgency": 0.0,
        "learning": 0.0,
    }

    signals: list[str] = []
    due_in_days = _days_to_due(task)
    required_skills_count = len(task.required_skills or [])

    if task.priority == "critical":
        scores["urgency"] += 4
        scores["efficiency"] += 1
        signals.append("La prioridad de la tarea es crítica")
    elif task.priority == "high":
        scores["urgency"] += 3
        scores["efficiency"] += 1
        signals.append("La prioridad de la tarea es alta")
    elif task.priority == "medium":
        scores["balance"] += 1
        signals.append("La prioridad de la tarea es media")

    if due_in_days is not None:
        if due_in_days <= 2:
            scores["urgency"] += 4
            signals.append("La fecha límite está muy próxima")
        elif due_in_days <= 5:
            scores["urgency"] += 3
            signals.append("La fecha límite está próxima")
        elif due_in_days <= 10:
            scores["balance"] += 1
            signals.append("La tarea tiene una ventana de ejecución moderada")
        else:
            scores["learning"] += 1
            signals.append("La tarea tiene margen temporal para aprendizaje o iteración")

    if task.complexity >= 4:
        scores["efficiency"] += 3
        scores["urgency"] += 1
        signals.append("La complejidad de la tarea es alta")
    elif task.complexity == 3:
        scores["balance"] += 2
        signals.append("La complejidad de la tarea es moderada")
    else:
        scores["learning"] += 1
        signals.append("La complejidad de la tarea es manejable")

    if required_skills_count >= 3:
        scores["efficiency"] += 3
        signals.append("La tarea requiere varias habilidades específicas")
    elif required_skills_count >= 1:
        scores["balance"] += 1.5
        scores["efficiency"] += 1.5
        signals.append("La tarea requiere habilidades técnicas o funcionales específicas")
    else:
        scores["learning"] += 1

    if task.task_type in {"bug", "operations"}:
        scores["urgency"] += 2
        signals.append("El tipo de tarea favorece una respuesta operativa rápida")

    if task.task_type in {"feature", "design"}:
        scores["efficiency"] += 2
        scores["balance"] += 1
        signals.append("El tipo de tarea requiere ejecución técnica y coordinación")

    if task.task_type in {"documentation", "research"}:
        scores["balance"] += 2
        scores["learning"] += 1
        signals.append("El tipo de tarea requiere análisis, síntesis o documentación")

    if context_flags["data"]:
        scores["efficiency"] += 2
        signals.append("La tarea involucra definición técnica o estructural de datos")

    if context_flags["document"]:
        scores["balance"] += 2
        signals.append("La tarea exige claridad documental y trazabilidad del proceso")

    if context_flags["ui"]:
        scores["balance"] += 1
        signals.append("La tarea tiene una dimensión de experiencia e interfaz")

    priority_order = {
        "urgency": 4,
        "efficiency": 3,
        "balance": 2,
        "learning": 1,
    }

    strategy = max(
        scores.items(),
        key=lambda item: (item[1], priority_order[item[0]]),
    )[0]

    return strategy, _unique_preserve_order(signals)


def _infer_confidence(task: Task, signals: list[str], suggested_skills: list[str]) -> str:
    evidence_points = 0

    if len(signals) >= 4:
        evidence_points += 2
    elif len(signals) >= 2:
        evidence_points += 1

    if len(task.required_skills or []) >= 2:
        evidence_points += 2
    elif len(task.required_skills or []) == 1:
        evidence_points += 1

    if len(suggested_skills) >= 3:
        evidence_points += 1

    due_in_days = _days_to_due(task)
    if due_in_days is not None and due_in_days <= 5:
        evidence_points += 1

    if evidence_points >= 5:
        return "alta"
    if evidence_points >= 3:
        return "media"
    return "baja"


def _build_explanation(strategy: str, signals: list[str], area: str, skills: list[str]) -> str:
    label = STRATEGY_LABELS.get(strategy, strategy.capitalize())

    signal_text = ", ".join(signals[:3]) if signals else "la naturaleza general de la tarea"
    skills_text = ", ".join(skills[:3]) if skills else "habilidades transversales"

    return (
        f"Se sugiere la estrategia de {label} porque la tarea presenta señales como {signal_text}. "
        f"Además, el sistema la ubica principalmente en el área de {area} y considera relevantes habilidades como {skills_text}."
    )


def build_task_insight_response(task: Task) -> TaskInsightResponse:
    normalized_text = normalize_text(_collect_task_text(task))
    context_flags = _infer_context_flags(task, normalized_text)
    suggested_area = _infer_area(task, normalized_text, context_flags)
    suggested_skills = _suggest_skills(task, normalized_text, context_flags)
    suggested_strategy, detected_signals = _infer_strategy(task, normalized_text, context_flags)
    confidence_level = _infer_confidence(task, detected_signals, suggested_skills)
    explanation = _build_explanation(
        suggested_strategy,
        detected_signals,
        suggested_area,
        suggested_skills,
    )

    return TaskInsightResponse(
        task_id=task.id,
        task_title=task.title,
        suggested_strategy=suggested_strategy,
        suggested_strategy_label=STRATEGY_LABELS.get(suggested_strategy, suggested_strategy.capitalize()),
        suggested_area=suggested_area,
        suggested_skills=suggested_skills,
        confidence_level=confidence_level,
        detected_signals=detected_signals[:5],
        explanation=explanation,
    )