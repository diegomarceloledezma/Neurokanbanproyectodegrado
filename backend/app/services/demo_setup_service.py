from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
import random
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Project,
    ProjectMember,
    Skill,
    SkillAlias,
    Task,
    TaskAssignmentHistory,
    TaskOutcome,
    TaskRequiredSkill,
    User,
    UserSkill,
)
from app.services.recommendation_engine import build_assignment_snapshot_data


@dataclass
class DemoTaskInfo:
    id: int
    title: str
    task_type: str
    recommended_strategy: str


@dataclass
class DemoScenarioResult:
    project_id: int
    project_name: str
    source_project_id: int
    members_copied: int
    background_tasks_created: int
    demo_tasks_created: int
    demo_tasks: list[DemoTaskInfo]


@dataclass
class TrainingBatchResult:
    source_project_id: int
    scenarios_created: int
    projects_created: int
    tasks_created: int
    assignment_histories_created: int
    outcomes_created: int
    created_project_ids: list[int]
    sample_tasks: list[dict[str, Any]]


BENCHMARK_TASK_TEMPLATES = [
    {
        "title": "Desarrollar formulario autenticado de acceso",
        "task_type": "feature",
        "priority": "high",
        "complexity": 3,
        "estimated_hours": 8,
        "recommended_strategy": "balance",
        "skills": [("React", 4), ("UX/UI", 3)],
    },
    {
        "title": "Optimizar endpoint de autenticación y sesiones",
        "task_type": "improvement",
        "priority": "high",
        "complexity": 4,
        "estimated_hours": 9,
        "recommended_strategy": "efficiency",
        "skills": [("FastAPI", 4), ("Seguridad de aplicaciones", 3)],
    },
    {
        "title": "Diseñar estructura de tablas para trazabilidad",
        "task_type": "feature",
        "priority": "medium",
        "complexity": 4,
        "estimated_hours": 7,
        "recommended_strategy": "efficiency",
        "skills": [("PostgreSQL", 4), ("Análisis de datos", 2)],
    },
    {
        "title": "Documentar flujo de recomendación inteligente",
        "task_type": "documentation",
        "priority": "medium",
        "complexity": 3,
        "estimated_hours": 5,
        "recommended_strategy": "learning",
        "skills": [("Documentación", 4), ("Redacción", 3), ("Investigación", 3)],
    },
    {
        "title": "Refinar interfaz de tablero para líderes",
        "task_type": "design",
        "priority": "medium",
        "complexity": 3,
        "estimated_hours": 6,
        "recommended_strategy": "balance",
        "skills": [("UX/UI", 4), ("Diseño de interfaces", 3), ("Prototipado", 3)],
    },
    {
        "title": "Corregir fallo crítico en validación de acceso",
        "task_type": "bug",
        "priority": "critical",
        "complexity": 4,
        "estimated_hours": 6,
        "recommended_strategy": "urgency",
        "skills": [("FastAPI", 4), ("Seguridad de aplicaciones", 4)],
    },
    {
        "title": "Preparar reporte técnico de desempeño del sprint",
        "task_type": "documentation",
        "priority": "medium",
        "complexity": 2,
        "estimated_hours": 4,
        "recommended_strategy": "learning",
        "skills": [("Documentación", 3), ("Redacción de informes", 3)],
    },
    {
        "title": "Investigar mejoras de visualización del dashboard",
        "task_type": "research",
        "priority": "low",
        "complexity": 2,
        "estimated_hours": 4,
        "recommended_strategy": "learning",
        "skills": [("Investigación", 3), ("UX/UI", 2)],
    },
    {
        "title": "Planificar tablero Kanban del siguiente sprint",
        "task_type": "operations",
        "priority": "medium",
        "complexity": 2,
        "estimated_hours": 3,
        "recommended_strategy": "balance",
        "skills": [("Kanban", 3), ("Planificación", 3)],
    },
    {
        "title": "Implementar ajustes de backend para métricas del equipo",
        "task_type": "feature",
        "priority": "high",
        "complexity": 4,
        "estimated_hours": 8,
        "recommended_strategy": "efficiency",
        "skills": [("FastAPI", 4), ("Análisis de datos", 3)],
    },
    {
        "title": "Preparar mejora visual para reportes ejecutivos",
        "task_type": "design",
        "priority": "medium",
        "complexity": 3,
        "estimated_hours": 5,
        "recommended_strategy": "balance",
        "skills": [("Diseño gráfico", 3), ("UX/UI", 3)],
    },
    {
        "title": "Resolver soporte funcional del módulo de asignación",
        "task_type": "operations",
        "priority": "high",
        "complexity": 3,
        "estimated_hours": 5,
        "recommended_strategy": "urgency",
        "skills": [("Soporte técnico", 3), ("Comunicación oral", 3)],
    },
]


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(value.strip().lower().split())


def _get_skill_lookup(db: Session) -> dict[str, Skill]:
    lookup: dict[str, Skill] = {}
    skills = db.query(Skill).all()
    aliases = db.query(SkillAlias).all()

    skills_by_id = {skill.id: skill for skill in skills}

    for skill in skills:
        for key in {
            _normalize_text(skill.name),
            _normalize_text(skill.canonical_name),
        }:
            if key:
                lookup[key] = skill

    for alias in aliases:
        key = _normalize_text(alias.alias_name) or _normalize_text(alias.normalized_alias)
        if key and alias.skill_id:
            skill = skills_by_id.get(alias.skill_id)
            if skill:
                lookup[key] = skill

    return lookup


def _require_skill(lookup: dict[str, Skill], name: str) -> Skill:
    skill = lookup.get(_normalize_text(name))
    if not skill:
        raise ValueError(f"No se encontró la habilidad requerida en la base: {name}")
    return skill


def _deduplicate_required_skill_entries(
    skill_lookup: dict[str, Skill],
    skill_entries: list[tuple[str, int]],
) -> list[dict[str, Any]]:
    dedup: dict[int, dict[str, Any]] = {}

    for skill_name, required_level in skill_entries:
        skill = _require_skill(skill_lookup, skill_name)

        current = dedup.get(skill.id)
        if current is None:
            dedup[skill.id] = {
                "skill": skill,
                "required_level": int(required_level),
                "source_names": [skill_name],
            }
            continue

        current["required_level"] = max(int(required_level), int(current["required_level"]))
        current["source_names"].append(skill_name)

    return list(dedup.values())


def _get_source_project_members(db: Session, source_project_id: int) -> tuple[Project, list[ProjectMember]]:
    source_project = db.query(Project).filter(Project.id == source_project_id).first()
    if not source_project:
        raise ValueError("Proyecto fuente no encontrado")

    source_members = (
        db.query(ProjectMember)
        .options(
            joinedload(ProjectMember.user)
            .joinedload(User.user_skills)
            .joinedload(UserSkill.skill),
            joinedload(ProjectMember.user).joinedload(User.global_role),
        )
        .filter(ProjectMember.project_id == source_project_id)
        .order_by(ProjectMember.user_id.asc())
        .all()
    )
    if not source_members:
        raise ValueError("El proyecto fuente no tiene integrantes para crear el escenario")

    return source_project, source_members


def _copy_members_to_project(db: Session, project: Project, source_members: list[ProjectMember]) -> None:
    for member in source_members:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=member.user_id,
                project_role=member.project_role,
                weekly_capacity_hours=member.weekly_capacity_hours,
                availability_percentage=member.availability_percentage,
            )
        )


def _member_skill_score(member: ProjectMember, required_skills: list[Skill]) -> tuple[int, int]:
    if not member.user:
        return (0, 0)

    member_skills = {user_skill.skill_id: user_skill for user_skill in member.user.user_skills or []}
    exact = 0
    partial = 0
    for skill in required_skills:
        if skill.id in member_skills:
            exact += 1
            partial += max(int(member_skills[skill.id].level or 0), 1)
    return exact, partial


def _pick_assignee(
    source_members: list[ProjectMember],
    required_skills: list[Skill],
    strategy: str,
    rng: random.Random,
    scenario_index: int,
) -> ProjectMember:
    ranked = []
    for member in source_members:
        exact, weighted = _member_skill_score(member, required_skills)
        role_bonus = 1 if (member.user and member.user.global_role and member.user.global_role.name == "member") else 0
        ranked.append((member, exact, weighted, role_bonus))

    ranked.sort(key=lambda item: (item[1], item[2], item[3]), reverse=True)

    exact_matches = [item for item in ranked if item[1] == len(required_skills) and len(required_skills) > 0]
    partial_matches = [item for item in ranked if item[1] > 0 and item not in exact_matches]

    if strategy == "learning":
        if partial_matches:
            return partial_matches[scenario_index % len(partial_matches)][0]
        if exact_matches:
            return exact_matches[-1][0]
    elif strategy == "urgency":
        if exact_matches:
            return exact_matches[0][0]
        if partial_matches:
            return partial_matches[0][0]
    else:
        if exact_matches:
            return exact_matches[0][0]
        if partial_matches:
            return partial_matches[0][0]

    return ranked[scenario_index % len(ranked)][0]


def _compute_outcome_values(
    *,
    strategy: str,
    exact_match_count: int,
    required_count: int,
    complexity: int,
    estimated_hours: float,
    rng: random.Random,
    scenario_index: int,
) -> dict[str, Any]:
    match_ratio = (exact_match_count / required_count) if required_count > 0 else 0.5

    if strategy == "efficiency":
        base_quality = 4.3 if match_ratio >= 1 else 3.4
        on_time_bias = 0.78 if match_ratio >= 1 else 0.52
    elif strategy == "urgency":
        base_quality = 4.0 if match_ratio >= 1 else 3.2
        on_time_bias = 0.82 if match_ratio >= 0.5 else 0.48
    elif strategy == "learning":
        base_quality = 3.9 if match_ratio >= 1 else 3.4
        on_time_bias = 0.62 if match_ratio >= 0.5 else 0.40
    else:
        base_quality = 4.1 if match_ratio >= 1 else 3.5
        on_time_bias = 0.74 if match_ratio >= 0.5 else 0.44

    if complexity >= 4:
        base_quality -= 0.3
        on_time_bias -= 0.08

    quality_score = int(round(max(2, min(5, base_quality + rng.uniform(-0.4, 0.4)))))
    finished_on_time = rng.random() < max(0.15, min(0.92, on_time_bias))

    if finished_on_time:
        actual_hours = round(max(1.0, estimated_hours * rng.uniform(0.85, 1.05)), 2)
        delay_hours = 0.0
    else:
        overrun_factor = rng.uniform(1.10, 1.45 if exact_match_count == 0 else 1.25)
        actual_hours = round(max(1.0, estimated_hours * overrun_factor), 2)
        delay_hours = round(max(actual_hours - estimated_hours, 0.5), 2)

    had_rework = quality_score <= 3 and rng.random() < 0.55
    rework_count = 1 if had_rework else 0

    success_score = 0.0
    if finished_on_time:
        success_score += 35
    else:
        success_score += max(0.0, 15 - delay_hours * 1.8)
    success_score += quality_score * 12
    success_score += -8 if had_rework else 10
    success_score = round(max(0.0, min(100.0, success_score)), 2)

    completed_at = datetime.utcnow() - timedelta(days=max(1, 10 - (scenario_index % 7)))

    return {
        "completed_at": completed_at,
        "finished_on_time": finished_on_time,
        "delay_hours": delay_hours,
        "quality_score": quality_score,
        "had_rework": had_rework,
        "rework_count": rework_count,
        "success_score": success_score,
        "actual_hours": actual_hours,
    }


def _create_closed_training_task(
    db: Session,
    *,
    project: Project,
    creator_id: int | None,
    assignee_member: ProjectMember,
    skill_lookup: dict[str, Skill],
    template: dict[str, Any],
    rng: random.Random,
    scenario_index: int,
) -> dict[str, Any]:
    deduped_required_entries = _deduplicate_required_skill_entries(
        skill_lookup,
        template["skills"],
    )
    required_skills = [entry["skill"] for entry in deduped_required_entries]
    exact_match_count, _ = _member_skill_score(assignee_member, required_skills)

    task = Task(
        project_id=project.id,
        title=template["title"],
        description="Caso histórico interno generado para fortalecer la base de entrenamiento con escenarios controlados.",
        task_type=template["task_type"],
        priority=template["priority"],
        complexity=template["complexity"],
        status="done",
        estimated_hours=template["estimated_hours"],
        actual_hours=None,
        due_date=date.today() - timedelta(days=2 + (scenario_index % 5)),
        created_by=creator_id,
        assigned_to=assignee_member.user_id,
    )
    db.add(task)
    db.flush()

    for entry in deduped_required_entries:
        db.add(
            TaskRequiredSkill(
                task_id=task.id,
                skill_id=entry["skill"].id,
                required_level=entry["required_level"],
            )
        )

    db.flush()

    snapshot = build_assignment_snapshot_data(
        db=db,
        task=task,
        assigned_user_id=assignee_member.user_id,
        strategy=template["recommended_strategy"],
    )

    if not snapshot:
        raise ValueError(f"No se pudo construir snapshot para la tarea benchmark {task.title}")

    history = TaskAssignmentHistory(
        task_id=task.id,
        assigned_to=assignee_member.user_id,
        assigned_by=creator_id,
        source="benchmark_batch",
        strategy=template["recommended_strategy"],
        recommendation_score=snapshot.get("recommendation_score"),
        risk_level=snapshot.get("risk_level"),
        reason="Registro benchmark generado automáticamente para ampliar la base de entrenamiento con trazabilidad controlada.",
        recommendation_used=True,
        workload_score=snapshot.get("workload_score"),
        skill_match_score=snapshot.get("skill_match_score"),
        availability_score=snapshot.get("availability_score"),
        performance_score=snapshot.get("performance_score"),
        current_load_snapshot=snapshot.get("current_load_snapshot"),
        availability_snapshot=snapshot.get("availability_snapshot"),
        active_tasks_snapshot=snapshot.get("active_tasks_snapshot"),
        required_skills_count=snapshot.get("required_skills_count"),
        matching_skills_count=snapshot.get("matching_skills_count"),
        matching_ratio=snapshot.get("matching_ratio"),
        estimated_hours_snapshot=snapshot.get("estimated_hours_snapshot"),
        priority_snapshot=snapshot.get("priority_snapshot"),
        complexity_snapshot=snapshot.get("complexity_snapshot"),
    )
    db.add(history)

    outcome_values = _compute_outcome_values(
        strategy=template["recommended_strategy"],
        exact_match_count=exact_match_count,
        required_count=len(required_skills),
        complexity=template["complexity"],
        estimated_hours=float(template["estimated_hours"]),
        rng=rng,
        scenario_index=scenario_index,
    )

    task.actual_hours = outcome_values["actual_hours"]
    outcome = TaskOutcome(
        task_id=task.id,
        completed_at=outcome_values["completed_at"],
        finished_on_time=outcome_values["finished_on_time"],
        delay_hours=outcome_values["delay_hours"],
        quality_score=outcome_values["quality_score"],
        had_rework=outcome_values["had_rework"],
        rework_count=outcome_values["rework_count"],
        success_score=outcome_values["success_score"],
        notes="Resultado benchmark generado automáticamente para ampliar dataset interno.",
    )
    db.add(outcome)

    return {
        "task_id": task.id,
        "title": task.title,
        "strategy": template["recommended_strategy"],
        "assignee_user_id": assignee_member.user_id,
        "assignee_name": assignee_member.user.full_name if assignee_member.user else "No disponible",
        "success_score": outcome_values["success_score"],
    }


def create_demo_scenario(
    db: Session,
    *,
    source_project_id: int = 1,
    seed: int = 42,
) -> DemoScenarioResult:
    rng = random.Random(seed)

    source_project, source_members = _get_source_project_members(db, source_project_id)

    project_name = f"NeuroKanban Demo IA {date.today().strftime('%Y%m%d')}-{rng.randint(1000, 9999)}"
    demo_project = Project(
        team_id=source_project.team_id,
        area_id=source_project.area_id,
        name=project_name,
        description=(
            "Proyecto de demostración generado automáticamente para mostrar "
            "recomendación heurística vs híbrida en un escenario más claro."
        ),
        status="active",
        start_date=date.today(),
        created_by=source_project.created_by,
    )
    db.add(demo_project)
    db.flush()

    _copy_members_to_project(db, demo_project, source_members)
    db.flush()

    skill_lookup = _get_skill_lookup(db)

    member_ids = [member.user_id for member in source_members]
    if len(member_ids) < 4:
        raise ValueError("Se requieren al menos 4 integrantes en el proyecto fuente para el escenario demo")

    leader_id = member_ids[0]
    frontend_id = member_ids[1]
    backend_id = member_ids[2]
    docs_id = member_ids[3]

    background_tasks = [
        {
            "title": "Coordinar backlog general del sprint",
            "task_type": "operations",
            "priority": "high",
            "complexity": 3,
            "estimated_hours": 8,
            "assigned_to": leader_id,
            "status": "in_progress",
            "skills": ["Coordinación"],
        },
        {
            "title": "Refinar componente visual del dashboard",
            "task_type": "design",
            "priority": "medium",
            "complexity": 2,
            "estimated_hours": 4,
            "assigned_to": frontend_id,
            "status": "in_progress",
            "skills": ["React", "UX/UI"],
        },
        {
            "title": "Ajustar endpoint de autenticación",
            "task_type": "feature",
            "priority": "medium",
            "complexity": 3,
            "estimated_hours": 6,
            "assigned_to": backend_id,
            "status": "in_progress",
            "skills": ["FastAPI"],
        },
        {
            "title": "Actualizar documentación operativa inicial",
            "task_type": "documentation",
            "priority": "low",
            "complexity": 2,
            "estimated_hours": 2,
            "assigned_to": docs_id,
            "status": "in_progress",
            "skills": ["Documentación"],
        },
    ]

    created_background_tasks = 0
    for item in background_tasks:
        task = Task(
            project_id=demo_project.id,
            title=item["title"],
            description="Tarea de contexto para construir una carga realista en la demostración.",
            task_type=item["task_type"],
            priority=item["priority"],
            complexity=item["complexity"],
            status=item["status"],
            estimated_hours=item["estimated_hours"],
            actual_hours=None,
            due_date=date.today() + timedelta(days=7),
            created_by=leader_id,
            assigned_to=item["assigned_to"],
        )
        db.add(task)
        db.flush()

        background_skill_entries = _deduplicate_required_skill_entries(
            skill_lookup,
            [(skill_name, 3) for skill_name in item["skills"]],
        )

        for entry in background_skill_entries:
            db.add(
                TaskRequiredSkill(
                    task_id=task.id,
                    skill_id=entry["skill"].id,
                    required_level=entry["required_level"],
                )
            )
        created_background_tasks += 1

    demo_tasks_config = [
        {
            "title": "Diseñar modelo de base de datos del módulo inteligente",
            "description": (
                "Se requiere una propuesta técnica para estructurar entidades, relaciones y "
                "persistencia del módulo de asignación inteligente."
            ),
            "task_type": "feature",
            "priority": "high",
            "complexity": 4,
            "estimated_hours": 8,
            "skills": [("PostgreSQL", 4), ("FastAPI", 3)],
            "recommended_strategy": "balance",
        },
        {
            "title": "Refinar interfaz del tablero Kanban para líderes",
            "description": (
                "Se necesita mejorar la experiencia visual del tablero y priorizar claridad "
                "para equipos multidisciplinarios."
            ),
            "task_type": "design",
            "priority": "medium",
            "complexity": 3,
            "estimated_hours": 6,
            "skills": [("React", 3), ("UX/UI", 4)],
            "recommended_strategy": "efficiency",
        },
        {
            "title": "Documentar flujo de asignación inteligente y trazabilidad",
            "description": (
                "Se requiere una guía clara para explicar cómo funciona la recomendación, "
                "la simulación y el historial de decisiones."
            ),
            "task_type": "documentation",
            "priority": "medium",
            "complexity": 3,
            "estimated_hours": 5,
            "skills": [("Documentación", 4), ("Investigación", 3), ("Redacción", 3)],
            "recommended_strategy": "learning",
        },
    ]

    demo_tasks: list[DemoTaskInfo] = []

    for cfg in demo_tasks_config:
        task = Task(
            project_id=demo_project.id,
            title=cfg["title"],
            description=cfg["description"],
            task_type=cfg["task_type"],
            priority=cfg["priority"],
            complexity=cfg["complexity"],
            status="pending",
            estimated_hours=cfg["estimated_hours"],
            actual_hours=None,
            due_date=date.today() + timedelta(days=5),
            created_by=leader_id,
            assigned_to=None,
        )
        db.add(task)
        db.flush()

        demo_skill_entries = _deduplicate_required_skill_entries(
            skill_lookup,
            cfg["skills"],
        )

        for entry in demo_skill_entries:
            db.add(
                TaskRequiredSkill(
                    task_id=task.id,
                    skill_id=entry["skill"].id,
                    required_level=entry["required_level"],
                )
            )

        demo_tasks.append(
            DemoTaskInfo(
                id=task.id,
                title=task.title,
                task_type=task.task_type,
                recommended_strategy=cfg["recommended_strategy"],
            )
        )

    db.commit()

    return DemoScenarioResult(
        project_id=demo_project.id,
        project_name=demo_project.name,
        source_project_id=source_project_id,
        members_copied=len(source_members),
        background_tasks_created=created_background_tasks,
        demo_tasks_created=len(demo_tasks),
        demo_tasks=demo_tasks,
    )


def create_training_benchmark_batch(
    db: Session,
    *,
    source_project_id: int = 1,
    scenario_count: int = 4,
    seed: int = 42,
) -> TrainingBatchResult:
    rng = random.Random(seed)
    source_project, source_members = _get_source_project_members(db, source_project_id)
    skill_lookup = _get_skill_lookup(db)

    if scenario_count < 1:
        raise ValueError("Se requiere al menos un escenario para generar el batch de entrenamiento")

    created_project_ids: list[int] = []
    sample_tasks: list[dict[str, Any]] = []
    tasks_created = 0
    histories_created = 0
    outcomes_created = 0

    for scenario_index in range(scenario_count):
        project_name = (
            f"NeuroKanban Training Batch {date.today().strftime('%Y%m%d')}"
            f"-{rng.randint(1000, 9999)}-S{scenario_index + 1}"
        )
        project = Project(
            team_id=source_project.team_id,
            area_id=source_project.area_id,
            name=project_name,
            description=(
                "Proyecto benchmark generado automáticamente para ampliar la base de entrenamiento "
                "con tareas cerradas, outcomes y trazabilidad controlada."
            ),
            status="completed",
            start_date=date.today() - timedelta(days=30 + scenario_index),
            end_date=date.today() - timedelta(days=max(1, scenario_index)),
            created_by=source_project.created_by,
        )
        db.add(project)
        db.flush()

        _copy_members_to_project(db, project, source_members)
        db.flush()
        created_project_ids.append(project.id)

        for template_index, template in enumerate(BENCHMARK_TASK_TEMPLATES):
            required_entries = _deduplicate_required_skill_entries(
                skill_lookup,
                template["skills"],
            )
            required_skills = [entry["skill"] for entry in required_entries]

            assignee_member = _pick_assignee(
                source_members,
                required_skills,
                template["recommended_strategy"],
                rng,
                scenario_index + template_index,
            )

            task_result = _create_closed_training_task(
                db,
                project=project,
                creator_id=source_project.created_by,
                assignee_member=assignee_member,
                skill_lookup=skill_lookup,
                template=template,
                rng=rng,
                scenario_index=scenario_index + template_index,
            )
            tasks_created += 1
            histories_created += 1
            outcomes_created += 1

            if len(sample_tasks) < 15:
                sample_tasks.append(task_result)

    db.commit()

    return TrainingBatchResult(
        source_project_id=source_project_id,
        scenarios_created=scenario_count,
        projects_created=len(created_project_ids),
        tasks_created=tasks_created,
        assignment_histories_created=histories_created,
        outcomes_created=outcomes_created,
        created_project_ids=created_project_ids,
        sample_tasks=sample_tasks,
    )