from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import random

from sqlalchemy.orm import Session

from app.models import Project, ProjectMember, Skill, Task, TaskRequiredSkill


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


def _get_skill_map(db: Session) -> dict[str, Skill]:
    skills = db.query(Skill).all()
    return {skill.name: skill for skill in skills}


def _require_skill(skill_map: dict[str, Skill], name: str) -> Skill:
    skill = skill_map.get(name)
    if not skill:
        raise ValueError(f"No se encontró la habilidad requerida en la base: {name}")
    return skill


def create_demo_scenario(
    db: Session,
    *,
    source_project_id: int = 1,
    seed: int = 42,
) -> DemoScenarioResult:
    rng = random.Random(seed)

    source_project = db.query(Project).filter(Project.id == source_project_id).first()
    if not source_project:
        raise ValueError("Proyecto fuente no encontrado")

    source_members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == source_project_id)
        .order_by(ProjectMember.user_id.asc())
        .all()
    )
    if not source_members:
        raise ValueError("El proyecto fuente no tiene integrantes para crear el escenario demo")

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

    for member in source_members:
        db.add(
            ProjectMember(
                project_id=demo_project.id,
                user_id=member.user_id,
                project_role=member.project_role,
                weekly_capacity_hours=member.weekly_capacity_hours,
                availability_percentage=member.availability_percentage,
            )
        )

    db.flush()

    skill_map = _get_skill_map(db)

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

        for skill_name in item["skills"]:
            skill = _require_skill(skill_map, skill_name)
            db.add(
                TaskRequiredSkill(
                    task_id=task.id,
                    skill_id=skill.id,
                    required_level=3,
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

        for skill_name, required_level in cfg["skills"]:
            skill = _require_skill(skill_map, skill_name)
            db.add(
                TaskRequiredSkill(
                    task_id=task.id,
                    skill_id=skill.id,
                    required_level=required_level,
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