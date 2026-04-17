from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import random
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    Project,
    ProjectMember,
    Skill,
    Task,
    TaskAssignmentHistory,
    TaskOutcome,
    TaskRequiredSkill,
    UserSkill,
)


PRIORITY_WEIGHTS = {
    "low": 0.10,
    "medium": 0.38,
    "high": 0.40,
    "critical": 0.12,
}

TASK_TYPE_WEIGHTS = {
    "feature": 0.13,
    "bug": 0.11,
    "improvement": 0.12,
    "research": 0.13,
    "documentation": 0.14,
    "design": 0.14,
    "marketing": 0.12,
    "operations": 0.11,
}

SOURCE_WEIGHTS = {
    "manual": 0.32,
    "recommended": 0.38,
    "hybrid": 0.30,
}

STRATEGY_WEIGHTS = {
    "balance": 0.34,
    "efficiency": 0.24,
    "urgency": 0.24,
    "learning": 0.18,
}

LOAD_BANDS = [
    {
        "name": "low",
        "weight": 0.28,
        "load_range": (12.0, 34.0),
        "active_tasks_range": (0, 2),
    },
    {
        "name": "medium",
        "weight": 0.44,
        "load_range": (35.0, 68.0),
        "active_tasks_range": (1, 4),
    },
    {
        "name": "high",
        "weight": 0.22,
        "load_range": (69.0, 90.0),
        "active_tasks_range": (2, 5),
    },
    {
        "name": "saturated",
        "weight": 0.06,
        "load_range": (91.0, 100.0),
        "active_tasks_range": (3, 6),
    },
]

TASK_TYPE_TEMPLATES = {
    "feature": [
        "Implementar módulo de seguimiento",
        "Desarrollar vista de resumen",
        "Construir flujo de validación",
    ],
    "bug": [
        "Corregir inconsistencia de estado",
        "Resolver error en formulario",
        "Ajustar cálculo de métricas",
    ],
    "improvement": [
        "Optimizar tablero principal",
        "Mejorar rendimiento de consulta",
        "Refinar experiencia del usuario",
    ],
    "research": [
        "Analizar patrones de asignación",
        "Investigar necesidades del equipo",
        "Evaluar alternativas metodológicas",
    ],
    "documentation": [
        "Documentar módulo de recomendaciones",
        "Redactar instructivo de uso",
        "Actualizar especificación funcional",
    ],
    "design": [
        "Diseñar flujo visual del panel",
        "Proponer mejoras de interfaz",
        "Crear componentes reutilizables",
    ],
    "marketing": [
        "Planificar campaña de difusión",
        "Redactar contenido para redes",
        "Diseñar piezas promocionales",
    ],
    "operations": [
        "Coordinar seguimiento de actividades",
        "Organizar cronograma operativo",
        "Gestionar control de entregables",
    ],
}


@dataclass
class SyntheticRow:
    source: str
    strategy: str
    recommendation_used: bool
    recommendation_score: float
    workload_score: float
    skill_match_score: float
    availability_score: float
    performance_score: float
    current_load_snapshot: float
    availability_snapshot: float
    active_tasks_snapshot: int
    required_skills_count: int
    matching_skills_count: int
    matching_ratio: float
    estimated_hours_snapshot: float
    priority_snapshot: str
    complexity_snapshot: int
    finished_on_time: bool
    delay_hours: float
    quality_score: int
    had_rework: bool
    success_score: float
    success_label: int
    task_type: str


@dataclass
class SyntheticGenerationResult:
    source_project_id: int
    target_project_id: int
    target_project_name: str
    created_dataset_project: bool
    background_tasks_created: int
    synthetic_tasks_created: int
    assignment_decisions_created: int
    outcomes_created: int
    sample_task_ids: list[int]
    label_distribution: dict[str, int]
    source_distribution: dict[str, int]
    strategy_distribution: dict[str, int]
    task_type_distribution: dict[str, int]
    seed: int


def _weighted_choice(rng: random.Random, weights: dict[str, float]) -> str:
    items = list(weights.items())
    labels = [item[0] for item in items]
    probs = [item[1] for item in items]
    return rng.choices(labels, weights=probs, k=1)[0]


def _weighted_band(rng: random.Random) -> dict[str, Any]:
    return rng.choices(LOAD_BANDS, weights=[band["weight"] for band in LOAD_BANDS], k=1)[0]


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(value, high))


def _round2(value: float) -> float:
    return round(float(value), 2)


def compute_success_score(
    *,
    finished_on_time: bool,
    delay_hours: float,
    quality_score: int,
    had_rework: bool,
) -> float:
    score = 0.0
    if finished_on_time:
        score += 35
    else:
        score += max(0.0, 15 - float(delay_hours) * 1.8)

    score += int(quality_score) * 12
    score += -8 if had_rework else 10

    return _round2(max(0.0, min(100.0, score)))


def compute_success_label(success_score: float) -> int:
    return 1 if float(success_score) >= 65.0 else 0


def _complexity_weights(task_type: str) -> dict[int, float]:
    if task_type in {"feature", "research", "design"}:
        return {2: 0.18, 3: 0.34, 4: 0.30, 5: 0.18}
    if task_type in {"bug", "documentation"}:
        return {1: 0.12, 2: 0.35, 3: 0.33, 4: 0.20}
    return {1: 0.10, 2: 0.28, 3: 0.35, 4: 0.20, 5: 0.07}


def _pick_complexity(rng: random.Random, task_type: str) -> int:
    weights = _complexity_weights(task_type)
    return int(rng.choices(list(weights.keys()), weights=list(weights.values()), k=1)[0])


def _estimated_hours(rng: random.Random, complexity: int, priority: str) -> float:
    base_map = {1: (2.0, 4.5), 2: (3.0, 7.0), 3: (5.0, 9.5), 4: (7.5, 13.5), 5: (10.0, 16.0)}
    low, high = base_map[complexity]
    priority_multiplier = {
        "low": 0.95,
        "medium": 1.00,
        "high": 1.08,
        "critical": 1.18,
    }[priority]
    return _round2(rng.uniform(low, high) * priority_multiplier)


def _performance_baselines(rng: random.Random, member_ids: list[int]) -> dict[int, float]:
    baselines: dict[int, float] = {}
    for member_id in member_ids:
        baselines[member_id] = _round2(rng.uniform(46, 74))
    return baselines


def _member_skill_ids(db: Session, member_ids: list[int]) -> dict[int, list[int]]:
    rows = db.query(UserSkill).filter(UserSkill.user_id.in_(member_ids)).all()
    result: dict[int, list[int]] = {member_id: [] for member_id in member_ids}
    for row in rows:
        result.setdefault(row.user_id, []).append(row.skill_id)
    return result


def _all_skill_ids(db: Session) -> list[int]:
    rows = db.query(Skill.id).order_by(Skill.id.asc()).all()
    return [skill_id for (skill_id,) in rows]


def _choose_required_skills(
    rng: random.Random,
    all_skill_ids: list[int],
    assigned_member_skill_ids: list[int],
    matching_count: int,
    required_count: int,
) -> list[int]:
    chosen: list[int] = []

    member_pool = assigned_member_skill_ids[:]
    rng.shuffle(member_pool)
    for skill_id in member_pool[: min(matching_count, len(member_pool))]:
        if skill_id not in chosen:
            chosen.append(skill_id)

    non_member_pool = [skill_id for skill_id in all_skill_ids if skill_id not in assigned_member_skill_ids]
    rng.shuffle(non_member_pool)
    for skill_id in non_member_pool:
        if len(chosen) >= required_count:
            break
        if skill_id not in chosen:
            chosen.append(skill_id)

    if len(chosen) < required_count:
        filler_pool = all_skill_ids[:]
        rng.shuffle(filler_pool)
        for skill_id in filler_pool:
            if len(chosen) >= required_count:
                break
            if skill_id not in chosen:
                chosen.append(skill_id)

    return chosen[:required_count]


def _matching_count_for_source(
    rng: random.Random,
    source: str,
    required_count: int,
    assigned_member_has_skills: bool,
) -> int:
    if not assigned_member_has_skills:
        return 0

    if source == "recommended":
        ratio = rng.choices([1.0, 0.66, 0.5, 0.33, 0.0], weights=[0.34, 0.28, 0.20, 0.12, 0.06], k=1)[0]
    elif source == "hybrid":
        ratio = rng.choices([1.0, 0.66, 0.5, 0.33, 0.0], weights=[0.22, 0.30, 0.25, 0.15, 0.08], k=1)[0]
    else:
        ratio = rng.choices([1.0, 0.66, 0.5, 0.33, 0.0], weights=[0.14, 0.20, 0.27, 0.22, 0.17], k=1)[0]

    count = int(round(required_count * ratio))
    return max(0, min(required_count, count))


def _component_scores(
    rng: random.Random,
    *,
    source: str,
    strategy: str,
    performance_base: float,
    complexity: int,
    priority: str,
    required_count: int,
    matching_count: int,
) -> dict[str, Any]:
    band = _weighted_band(rng)
    current_load = _round2(rng.uniform(*band["load_range"]))
    active_tasks = int(rng.randint(*band["active_tasks_range"]))

    availability = _round2(_clamp(100 - current_load + rng.uniform(-8, 8), 0, 100))

    if source == "recommended":
        availability = _round2(_clamp(availability + rng.uniform(4, 12), 0, 100))
        current_load = _round2(_clamp(current_load - rng.uniform(4, 10), 0, 100))
    elif source == "manual":
        availability = _round2(_clamp(availability + rng.uniform(-6, 4), 0, 100))
        current_load = _round2(_clamp(current_load + rng.uniform(-2, 8), 0, 100))

    if strategy == "urgency" and priority in {"high", "critical"}:
        availability = _round2(_clamp(availability + rng.uniform(3, 8), 0, 100))
    if strategy == "learning" and complexity >= 4:
        current_load = _round2(_clamp(current_load + rng.uniform(2, 8), 0, 100))

    workload_score = _round2(
        _clamp((100 - current_load) * 0.85 + max(0, 100 - active_tasks * 12) * 0.15)
    )

    matching_ratio = _round2((matching_count / required_count) * 100) if required_count > 0 else 0.0
    skill_match_noise = rng.uniform(-6, 6)
    skill_match_score = _round2(_clamp(matching_ratio + skill_match_noise, 0, 100))

    performance_score = _round2(
        _clamp(
            performance_base
            + rng.uniform(-8, 8)
            - (complexity - 3) * 2.5
            - (5 if priority == "critical" else 0)
        )
    )

    availability_score = _round2(availability)

    return {
        "current_load_snapshot": current_load,
        "availability_snapshot": availability,
        "active_tasks_snapshot": active_tasks,
        "workload_score": workload_score,
        "skill_match_score": skill_match_score,
        "availability_score": availability_score,
        "performance_score": performance_score,
        "matching_ratio": matching_ratio,
    }


def _recommendation_score(
    rng: random.Random,
    *,
    strategy: str,
    workload_score: float,
    skill_match_score: float,
    availability_score: float,
    performance_score: float,
) -> float:
    if strategy == "efficiency":
        score = (
            skill_match_score * 0.36
            + performance_score * 0.30
            + availability_score * 0.18
            + workload_score * 0.16
        )
    elif strategy == "urgency":
        score = (
            availability_score * 0.28
            + workload_score * 0.24
            + skill_match_score * 0.28
            + performance_score * 0.20
        )
    elif strategy == "learning":
        score = (
            skill_match_score * 0.25
            + workload_score * 0.16
            + availability_score * 0.16
            + performance_score * 0.18
            + rng.uniform(8, 18)
        )
    else:
        score = (
            skill_match_score * 0.34
            + workload_score * 0.24
            + availability_score * 0.20
            + performance_score * 0.22
        )

    score += rng.uniform(-4.5, 4.5)
    return _round2(_clamp(score, 0, 100))


def _outcome_from_features(
    rng: random.Random,
    *,
    source: str,
    strategy: str,
    skill_match_score: float,
    workload_score: float,
    availability_score: float,
    performance_score: float,
    priority: str,
    complexity: int,
    matching_ratio: float,
) -> tuple[bool, float, int, bool, float, int]:
    success_probability = 0.18
    success_probability += skill_match_score / 100 * 0.28
    success_probability += workload_score / 100 * 0.16
    success_probability += availability_score / 100 * 0.14
    success_probability += performance_score / 100 * 0.18
    success_probability += 0.04 if source == "recommended" else 0.0
    success_probability += 0.02 if source == "hybrid" else 0.0
    success_probability += 0.03 if strategy == "balance" else 0.0
    success_probability += 0.02 if strategy == "efficiency" and skill_match_score >= 60 else 0.0
    success_probability -= 0.05 if priority == "critical" else 0.0
    success_probability -= max(0, complexity - 3) * 0.05
    success_probability -= 0.06 if matching_ratio == 0 else 0.0
    success_probability += rng.uniform(-0.06, 0.06)
    success_probability = max(0.08, min(0.84, success_probability))

    success = rng.random() < success_probability

    if success:
        finished_on_time = rng.random() < 0.82
        if finished_on_time:
            delay_hours = 0.0
        else:
            delay_hours = _round2(rng.uniform(0.5, 3.2))
        quality_floor = 2 if matching_ratio < 50 else 3
        quality_score = int(rng.randint(quality_floor, 4))
        had_rework = rng.random() < (0.18 if strategy != "learning" else 0.28)
    else:
        finished_on_time = rng.random() < 0.12
        if finished_on_time:
            delay_hours = 0.0
        else:
            delay_hours = _round2(rng.uniform(2.0, 12.5))
        quality_score = int(rng.randint(1, 3 if matching_ratio >= 50 else 2))
        had_rework = rng.random() < 0.62

    success_score = compute_success_score(
        finished_on_time=finished_on_time,
        delay_hours=delay_hours,
        quality_score=quality_score,
        had_rework=had_rework,
    )
    success_label = compute_success_label(success_score)

    return finished_on_time, delay_hours, quality_score, had_rework, success_score, success_label


def _task_title(rng: random.Random, task_type: str, index: int) -> str:
    title = rng.choice(TASK_TYPE_TEMPLATES[task_type])
    return f"{title} #{index}"


def _risk_level(current_load: float, availability: float, skill_match_score: float, complexity: int) -> str:
    if current_load >= 90 or availability <= 5 or (skill_match_score < 35 and complexity >= 4):
        return "high"
    if current_load >= 70 or availability <= 25 or skill_match_score < 60:
        return "medium"
    return "low"


def _ensure_target_project(
    db: Session,
    source_project: Project,
    *,
    create_dataset_project: bool,
    rng: random.Random,
) -> tuple[Project, bool]:
    if not create_dataset_project:
        return source_project, False

    project_name = f"{source_project.name} - Dataset sintético IA {date.today().strftime('%Y%m%d')}_{rng.randint(100000, 999999)}"
    target_project = Project(
        team_id=source_project.team_id,
        area_id=source_project.area_id,
        name=project_name,
        description="Proyecto auxiliar generado para entrenamiento sintético del modelo de asignación.",
        status="active",
        start_date=date.today(),
        created_by=source_project.created_by,
    )
    db.add(target_project)
    db.flush()

    source_members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == source_project.id)
        .all()
    )

    for member in source_members:
        db.add(
            ProjectMember(
                project_id=target_project.id,
                user_id=member.user_id,
                project_role=member.project_role,
                weekly_capacity_hours=member.weekly_capacity_hours,
                availability_percentage=member.availability_percentage,
            )
        )

    db.flush()
    return target_project, True


def _create_background_tasks(
    db: Session,
    rng: random.Random,
    target_project: Project,
    member_ids: list[int],
) -> int:
    count = rng.randint(6, 10)
    for index in range(count):
        assignee = rng.choice(member_ids)
        status = rng.choice(["done", "in_progress", "review"])
        estimated_hours = _round2(rng.uniform(2.0, 8.0))
        actual_hours = estimated_hours if status == "done" else None
        db.add(
            Task(
                project_id=target_project.id,
                title=f"Tarea base sintética {index + 1}",
                description="Tarea auxiliar para dar contexto al histórico sintético.",
                task_type=rng.choice(list(TASK_TYPE_WEIGHTS.keys())),
                priority=rng.choice(list(PRIORITY_WEIGHTS.keys())),
                complexity=rng.randint(1, 4),
                status=status,
                estimated_hours=estimated_hours,
                actual_hours=actual_hours,
                due_date=date.today() + timedelta(days=rng.randint(1, 14)),
                created_by=member_ids[0],
                assigned_to=assignee,
            )
        )
    db.flush()
    return count


def generate_synthetic_history(
    db: Session,
    *,
    source_project_id: int,
    records_count: int = 120,
    seed: int = 42,
    create_dataset_project: bool = True,
) -> SyntheticGenerationResult:
    rng = random.Random(seed)

    source_project = db.query(Project).filter(Project.id == source_project_id).first()
    if not source_project:
        raise ValueError("Proyecto fuente no encontrado")

    target_project, created_dataset_project = _ensure_target_project(
        db,
        source_project,
        create_dataset_project=create_dataset_project,
        rng=rng,
    )

    target_members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == target_project.id)
        .all()
    )
    if not target_members:
        raise ValueError("El proyecto seleccionado no tiene miembros")

    member_ids = [member.user_id for member in target_members]
    performance_baselines = _performance_baselines(rng, member_ids)
    member_skill_ids = _member_skill_ids(db, member_ids)
    all_skill_ids = _all_skill_ids(db)
    if not all_skill_ids:
        raise ValueError("No existen habilidades registradas para generar dataset sintético")

    background_tasks_created = _create_background_tasks(db, rng, target_project, member_ids)

    label_distribution = {"success": 0, "failure_or_risk": 0}
    source_distribution: dict[str, int] = {key: 0 for key in SOURCE_WEIGHTS}
    strategy_distribution: dict[str, int] = {key: 0 for key in STRATEGY_WEIGHTS}
    task_type_distribution: dict[str, int] = {key: 0 for key in TASK_TYPE_WEIGHTS}
    sample_task_ids: list[int] = []

    for index in range(records_count):
        task_type = _weighted_choice(rng, TASK_TYPE_WEIGHTS)
        priority = _weighted_choice(rng, PRIORITY_WEIGHTS)
        strategy = _weighted_choice(rng, STRATEGY_WEIGHTS)
        source = _weighted_choice(rng, SOURCE_WEIGHTS)
        recommendation_used = source != "manual"
        complexity = _pick_complexity(rng, task_type)
        estimated_hours = _estimated_hours(rng, complexity, priority)

        assigned_to = rng.choice(member_ids)
        assigned_member_skill_ids = member_skill_ids.get(assigned_to, [])
        required_count = rng.randint(1, 3)
        matching_count = _matching_count_for_source(
            rng,
            source=source,
            required_count=required_count,
            assigned_member_has_skills=bool(assigned_member_skill_ids),
        )

        required_skill_ids = _choose_required_skills(
            rng,
            all_skill_ids=all_skill_ids,
            assigned_member_skill_ids=assigned_member_skill_ids,
            matching_count=matching_count,
            required_count=required_count,
        )

        components = _component_scores(
            rng,
            source=source,
            strategy=strategy,
            performance_base=performance_baselines[assigned_to],
            complexity=complexity,
            priority=priority,
            required_count=required_count,
            matching_count=matching_count,
        )

        recommendation_score = _recommendation_score(
            rng,
            strategy=strategy,
            workload_score=components["workload_score"],
            skill_match_score=components["skill_match_score"],
            availability_score=components["availability_score"],
            performance_score=components["performance_score"],
        )

        (
            finished_on_time,
            delay_hours,
            quality_score,
            had_rework,
            success_score,
            success_label,
        ) = _outcome_from_features(
            rng,
            source=source,
            strategy=strategy,
            skill_match_score=components["skill_match_score"],
            workload_score=components["workload_score"],
            availability_score=components["availability_score"],
            performance_score=components["performance_score"],
            priority=priority,
            complexity=complexity,
            matching_ratio=components["matching_ratio"],
        )

        task = Task(
            project_id=target_project.id,
            title=_task_title(rng, task_type, index + 1),
            description="Registro sintético generado para entrenamiento del modelo de asignación.",
            task_type=task_type,
            priority=priority,
            complexity=complexity,
            status="done",
            estimated_hours=estimated_hours,
            actual_hours=_round2(estimated_hours + delay_hours),
            due_date=date.today() + timedelta(days=rng.randint(2, 20)),
            created_by=member_ids[0],
            assigned_to=assigned_to,
        )
        db.add(task)
        db.flush()

        for skill_id in required_skill_ids:
            level = rng.randint(2, 5 if complexity >= 4 else 4)
            db.add(
                TaskRequiredSkill(
                    task_id=task.id,
                    skill_id=skill_id,
                    required_level=level,
                )
            )

        decision = TaskAssignmentHistory(
            task_id=task.id,
            assigned_to=assigned_to,
            assigned_by=member_ids[0],
            source=source,
            strategy=strategy,
            recommendation_score=recommendation_score,
            risk_level=_risk_level(
                components["current_load_snapshot"],
                components["availability_snapshot"],
                components["skill_match_score"],
                complexity,
            ),
            reason="Registro sintético calibrado para entrenamiento del modelo.",
            recommendation_used=recommendation_used,
            workload_score=components["workload_score"],
            skill_match_score=components["skill_match_score"],
            availability_score=components["availability_score"],
            performance_score=components["performance_score"],
            current_load_snapshot=components["current_load_snapshot"],
            availability_snapshot=components["availability_snapshot"],
            active_tasks_snapshot=components["active_tasks_snapshot"],
            required_skills_count=required_count,
            matching_skills_count=matching_count,
            matching_ratio=components["matching_ratio"],
            estimated_hours_snapshot=estimated_hours,
            priority_snapshot=priority,
            complexity_snapshot=complexity,
        )
        db.add(decision)
        db.flush()

        db.add(
            TaskOutcome(
                task_id=task.id,
                finished_on_time=finished_on_time,
                delay_hours=delay_hours,
                quality_score=quality_score,
                had_rework=had_rework,
                rework_count=1 if had_rework else 0,
                success_score=success_score,
                notes="Outcome sintético calibrado para entrenamiento.",
            )
        )
    
        if len(sample_task_ids) < 10:
            sample_task_ids.append(task.id)

        label_distribution["success" if success_label == 1 else "failure_or_risk"] += 1
        source_distribution[source] += 1
        strategy_distribution[strategy] += 1
        task_type_distribution[task_type] += 1

    db.commit()

    return SyntheticGenerationResult(
        source_project_id=source_project.id,
        target_project_id=target_project.id,
        target_project_name=target_project.name,
        created_dataset_project=created_dataset_project,
        background_tasks_created=background_tasks_created,
        synthetic_tasks_created=records_count,
        assignment_decisions_created=records_count,
        outcomes_created=records_count,
        sample_task_ids=sample_task_ids,
        label_distribution=label_distribution,
        source_distribution=source_distribution,
        strategy_distribution=strategy_distribution,
        task_type_distribution=task_type_distribution,
        seed=seed,
    )