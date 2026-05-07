from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import (
    ProjectMember,
    Task,
    TaskAssignmentHistory,
    TaskOutcome,
    TaskRequiredSkill,
    User,
)
from app.routes.auth import get_current_user, has_any_role
from app.schemas import (
    AssignmentHistoryDetailedItem,
    TaskAssignRequest,
    TaskBase,
    TaskCreate,
    TaskOutcomeCreate,
    TaskOutcomeResponse,
)
from app.services.recommendation_engine import (
    build_assignment_snapshot_data,
    load_task_or_none,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _load_task_with_relations(db: Session, task_id: int):
    return (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
            joinedload(Task.required_skills).joinedload(TaskRequiredSkill.skill),
        )
        .filter(Task.id == task_id)
        .first()
    )


def _is_project_member(db: Session, project_id: int, user_id: int) -> bool:
    return (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
        .first()
        is not None
    )


def _can_view_task(db: Session, task: Task, current_user: User) -> bool:
    if has_any_role(current_user, "admin"):
        return True

    if has_any_role(current_user, "leader"):
        if task.created_by == current_user.id:
            return True

        return _is_project_member(db, task.project_id, current_user.id)

    # Integrante: solo sus tareas
    return task.assigned_to == current_user.id


def _can_manage_task(db: Session, task: Task, current_user: User) -> bool:
    if has_any_role(current_user, "admin"):
        return True

    if has_any_role(current_user, "leader"):
        if task.created_by == current_user.id:
            return True

        return _is_project_member(db, task.project_id, current_user.id)

    return False


def _compute_success_score(
    *,
    finished_on_time: Optional[bool],
    delay_hours: float,
    quality_score: Optional[int],
    had_rework: bool,
) -> float:
    score = 0.0

    if finished_on_time:
        score += 35
    else:
        score += max(0.0, 15 - float(delay_hours or 0) * 1.8)

    score += int(quality_score or 0) * 12
    score += -8 if had_rework else 10

    return round(max(0.0, min(100.0, score)), 2)


def _resolve_success_score(outcome: TaskOutcome) -> float:
    if outcome.success_score is not None:
        return round(float(outcome.success_score), 2)

    return _compute_success_score(
        finished_on_time=outcome.finished_on_time,
        delay_hours=float(outcome.delay_hours or 0),
        quality_score=outcome.quality_score,
        had_rework=bool(outcome.had_rework),
    )


def _mean(values: list[float]) -> Optional[float]:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def _init_effectiveness_bucket(label: str) -> dict:
    return {
        "label": label,
        "count": 0,
        "success_scores": [],
        "quality_scores": [],
        "on_time_count": 0,
        "rework_count": 0,
    }


def _update_effectiveness_bucket(
    bucket: dict,
    *,
    success_score: float,
    finished_on_time: Optional[bool],
    had_rework: bool,
    quality_score: Optional[int],
) -> None:
    bucket["count"] += 1
    bucket["success_scores"].append(float(success_score))

    if finished_on_time is True:
        bucket["on_time_count"] += 1

    if had_rework:
        bucket["rework_count"] += 1

    if quality_score is not None:
        bucket["quality_scores"].append(float(quality_score))


def _finalize_effectiveness_bucket(bucket: dict) -> dict:
    count = bucket["count"] or 0

    return {
        "label": bucket["label"],
        "count": count,
        "average_success_score": _mean(bucket["success_scores"]),
        "average_quality_score": _mean(bucket["quality_scores"]),
        "on_time_rate": round((bucket["on_time_count"] / count) * 100, 2) if count else 0.0,
        "rework_rate": round((bucket["rework_count"] / count) * 100, 2) if count else 0.0,
    }


@router.get("/project/{project_id}", response_model=List[TaskBase])
def get_tasks_by_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if has_any_role(current_user, "admin", "leader"):
        if has_any_role(current_user, "leader") and not _is_project_member(
            db, project_id, current_user.id
        ):
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para ver las tareas de este proyecto",
            )

        tasks = (
            db.query(Task)
            .options(
                joinedload(Task.assignee).joinedload(User.global_role),
                joinedload(Task.creator).joinedload(User.global_role),
                joinedload(Task.required_skills).joinedload(TaskRequiredSkill.skill),
            )
            .filter(Task.project_id == project_id)
            .order_by(Task.id.asc())
            .all()
        )
        return tasks

    # Integrante: solo sus tareas dentro del proyecto
    tasks = (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
            joinedload(Task.required_skills).joinedload(TaskRequiredSkill.skill),
        )
        .filter(
            Task.project_id == project_id,
            Task.assigned_to == current_user.id,
        )
        .order_by(Task.id.asc())
        .all()
    )
    return tasks


@router.get("/assignment-history", response_model=List[AssignmentHistoryDetailedItem])
def get_assignment_history(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver el historial de asignaciones",
        )

    query = (
        db.query(TaskAssignmentHistory)
        .options(
            joinedload(TaskAssignmentHistory.task),
            joinedload(TaskAssignmentHistory.assigned_user).joinedload(User.global_role),
            joinedload(TaskAssignmentHistory.assigned_by_user).joinedload(User.global_role),
        )
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
    )

    if project_id is not None:
        if has_any_role(current_user, "leader") and not _is_project_member(
            db, project_id, current_user.id
        ):
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para ver el historial de este proyecto",
            )

        query = query.filter(Task.project_id == project_id)

    history = query.order_by(TaskAssignmentHistory.created_at.desc()).all()
    return history


@router.get("/assignment-effectiveness-summary")
def get_assignment_effectiveness_summary(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver este resumen",
        )

    if project_id is not None and has_any_role(current_user, "leader"):
        if not _is_project_member(db, project_id, current_user.id):
            raise HTTPException(
                status_code=403,
                detail="No tienes permisos para ver este proyecto",
            )

    query = (
        db.query(TaskAssignmentHistory, TaskOutcome, Task)
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
        .join(TaskOutcome, TaskOutcome.task_id == Task.id)
    )

    if project_id is not None:
        query = query.filter(Task.project_id == project_id)

    rows = query.order_by(TaskAssignmentHistory.created_at.desc()).all()

    if not rows:
        return {
            "project_id": project_id,
            "total_records_with_outcome": 0,
            "ai_records_with_outcome": 0,
            "non_ai_records_with_outcome": 0,
            "average_success_score_overall": None,
            "average_success_score_ai": None,
            "average_success_score_non_ai": None,
            "average_quality_score_overall": None,
            "overall_on_time_rate": 0.0,
            "overall_rework_rate": 0.0,
            "ai_on_time_rate": 0.0,
            "non_ai_on_time_rate": 0.0,
            "ai_vs_non_ai_gap": None,
            "source_breakdown": [],
            "strategy_breakdown": [],
        }

    all_scores: list[float] = []
    ai_scores: list[float] = []
    non_ai_scores: list[float] = []
    all_quality_scores: list[float] = []

    overall_on_time_count = 0
    overall_rework_count = 0

    ai_on_time_count = 0
    non_ai_on_time_count = 0

    ai_count = 0
    non_ai_count = 0

    source_buckets: dict[str, dict] = {}
    strategy_buckets: dict[str, dict] = {}

    for history, outcome, _task in rows:
        success_score = _resolve_success_score(outcome)
        source = (history.source or "manual").strip().lower()
        strategy = (history.strategy or "no_definida").strip().lower()
        quality_score = outcome.quality_score
        finished_on_time = outcome.finished_on_time
        had_rework = bool(outcome.had_rework)

        all_scores.append(success_score)

        if quality_score is not None:
            all_quality_scores.append(float(quality_score))

        if finished_on_time is True:
            overall_on_time_count += 1

        if had_rework:
            overall_rework_count += 1

        if source not in source_buckets:
            source_buckets[source] = _init_effectiveness_bucket(source)
        _update_effectiveness_bucket(
            source_buckets[source],
            success_score=success_score,
            finished_on_time=finished_on_time,
            had_rework=had_rework,
            quality_score=quality_score,
        )

        if strategy not in strategy_buckets:
            strategy_buckets[strategy] = _init_effectiveness_bucket(strategy)
        _update_effectiveness_bucket(
            strategy_buckets[strategy],
            success_score=success_score,
            finished_on_time=finished_on_time,
            had_rework=had_rework,
            quality_score=quality_score,
        )

        is_ai_source = source in {"heuristic", "hybrid"}

        if is_ai_source:
            ai_count += 1
            ai_scores.append(success_score)
            if finished_on_time is True:
                ai_on_time_count += 1
        else:
            non_ai_count += 1
            non_ai_scores.append(success_score)
            if finished_on_time is True:
                non_ai_on_time_count += 1

    average_success_score_ai = _mean(ai_scores)
    average_success_score_non_ai = _mean(non_ai_scores)

    ai_vs_non_ai_gap = None
    if average_success_score_ai is not None and average_success_score_non_ai is not None:
        ai_vs_non_ai_gap = round(average_success_score_ai - average_success_score_non_ai, 2)

    return {
        "project_id": project_id,
        "total_records_with_outcome": len(rows),
        "ai_records_with_outcome": ai_count,
        "non_ai_records_with_outcome": non_ai_count,
        "average_success_score_overall": _mean(all_scores),
        "average_success_score_ai": average_success_score_ai,
        "average_success_score_non_ai": average_success_score_non_ai,
        "average_quality_score_overall": _mean(all_quality_scores),
        "overall_on_time_rate": round((overall_on_time_count / len(rows)) * 100, 2),
        "overall_rework_rate": round((overall_rework_count / len(rows)) * 100, 2),
        "ai_on_time_rate": round((ai_on_time_count / ai_count) * 100, 2) if ai_count else 0.0,
        "non_ai_on_time_rate": round((non_ai_on_time_count / non_ai_count) * 100, 2)
        if non_ai_count
        else 0.0,
        "ai_vs_non_ai_gap": ai_vs_non_ai_gap,
        "source_breakdown": sorted(
            [_finalize_effectiveness_bucket(bucket) for bucket in source_buckets.values()],
            key=lambda item: item["count"],
            reverse=True,
        ),
        "strategy_breakdown": sorted(
            [_finalize_effectiveness_bucket(bucket) for bucket in strategy_buckets.values()],
            key=lambda item: item["count"],
            reverse=True,
        ),
    }


# IMPORTANTE: esta ruta va antes de "/{task_id}"
@router.get("/my", response_model=List[TaskBase])
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = (
        db.query(Task)
        .options(
            joinedload(Task.assignee).joinedload(User.global_role),
            joinedload(Task.creator).joinedload(User.global_role),
            joinedload(Task.required_skills).joinedload(TaskRequiredSkill.skill),
        )
        .filter(Task.assigned_to == current_user.id)
        .order_by(Task.id.asc())
        .all()
    )

    return tasks


@router.get("/{task_id}", response_model=TaskBase)
def get_task_by_id(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _load_task_with_relations(db, task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if not _can_view_task(db, task, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver esta tarea",
        )

    return task


@router.post("/", response_model=TaskBase)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para crear tareas",
        )

    if has_any_role(current_user, "leader") and not _is_project_member(
        db, payload.project_id, current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="No puedes crear tareas en un proyecto que no te pertenece",
        )

    new_task = Task(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        task_type=payload.task_type,
        priority=payload.priority,
        complexity=payload.complexity,
        status=payload.status,
        estimated_hours=payload.estimated_hours,
        actual_hours=payload.actual_hours,
        due_date=payload.due_date,
        created_by=current_user.id,
        assigned_to=payload.assigned_to,
    )

    db.add(new_task)
    db.flush()

    for required_skill in payload.required_skills:
        db.add(
            TaskRequiredSkill(
                task_id=new_task.id,
                skill_id=required_skill.skill_id,
                required_level=required_skill.required_level,
            )
        )

    db.commit()

    task = _load_task_with_relations(db, new_task.id)
    return task


@router.patch("/{task_id}/assign", response_model=TaskBase)
def assign_task(
    task_id: int,
    payload: TaskAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para asignar tareas",
        )

    task = load_task_or_none(db, task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if not _can_manage_task(db, task, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para gestionar esta tarea",
        )

    user = (
        db.query(User)
        .options(joinedload(User.global_role))
        .filter(User.id == payload.assigned_to, User.is_active.is_(True))
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Integrante no encontrado o inactivo")

    project_membership = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == task.project_id,
            ProjectMember.user_id == payload.assigned_to,
        )
        .first()
    )

    if not project_membership:
        raise HTTPException(
            status_code=400,
            detail="El integrante seleccionado no pertenece al proyecto de la tarea",
        )

    snapshot = build_assignment_snapshot_data(
        db=db,
        task=task,
        assigned_user_id=payload.assigned_to,
        strategy=payload.strategy,
    )

    if not snapshot:
        raise HTTPException(
            status_code=400,
            detail="No se pudo construir el snapshot de asignación para el integrante seleccionado",
        )

    task.assigned_to = payload.assigned_to

    history = TaskAssignmentHistory(
        task_id=task.id,
        assigned_to=payload.assigned_to,
        assigned_by=current_user.id,
        source=payload.source,
        strategy=payload.strategy,
        recommendation_score=(
            payload.recommendation_score
            if payload.recommendation_score is not None
            else snapshot["recommendation_score"]
        ),
        risk_level=payload.risk_level or snapshot["risk_level"],
        reason=payload.reason,
        recommendation_used=payload.recommendation_used,
        workload_score=snapshot["workload_score"],
        skill_match_score=snapshot["skill_match_score"],
        availability_score=snapshot["availability_score"],
        performance_score=snapshot["performance_score"],
        current_load_snapshot=snapshot["current_load_snapshot"],
        availability_snapshot=snapshot["availability_snapshot"],
        active_tasks_snapshot=snapshot["active_tasks_snapshot"],
        required_skills_count=snapshot["required_skills_count"],
        matching_skills_count=snapshot["matching_skills_count"],
        matching_ratio=snapshot["matching_ratio"],
        estimated_hours_snapshot=snapshot["estimated_hours_snapshot"],
        priority_snapshot=snapshot["priority_snapshot"],
        complexity_snapshot=snapshot["complexity_snapshot"],
    )

    db.add(history)
    db.commit()

    updated_task = _load_task_with_relations(db, task.id)
    return updated_task


@router.get("/{task_id}/assignment-history", response_model=List[AssignmentHistoryDetailedItem])
def get_task_assignment_history(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if not _can_view_task(db, task, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver el historial de esta tarea",
        )

    history = (
        db.query(TaskAssignmentHistory)
        .options(
            joinedload(TaskAssignmentHistory.task),
            joinedload(TaskAssignmentHistory.assigned_user).joinedload(User.global_role),
            joinedload(TaskAssignmentHistory.assigned_by_user).joinedload(User.global_role),
        )
        .filter(TaskAssignmentHistory.task_id == task_id)
        .order_by(TaskAssignmentHistory.created_at.desc())
        .all()
    )

    return history


@router.get("/{task_id}/outcome", response_model=Optional[TaskOutcomeResponse])
def get_task_outcome(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if not _can_view_task(db, task, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para ver el resultado de esta tarea",
        )

    outcome = db.query(TaskOutcome).filter(TaskOutcome.task_id == task_id).first()
    return outcome


@router.post("/{task_id}/outcome", response_model=TaskOutcomeResponse)
def upsert_task_outcome(
    task_id: int,
    payload: TaskOutcomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if not _can_manage_task(db, task, current_user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para registrar el resultado de esta tarea",
        )

    normalized_rework_count = (
        payload.rework_count
        if payload.rework_count is not None
        else (1 if payload.had_rework else 0)
    )

    normalized_had_rework = payload.had_rework

    if normalized_rework_count and normalized_rework_count > 0:
        normalized_had_rework = True

    if normalized_had_rework and (normalized_rework_count is None or normalized_rework_count <= 0):
        normalized_rework_count = 1

    success_score = _compute_success_score(
        finished_on_time=payload.finished_on_time,
        delay_hours=payload.delay_hours,
        quality_score=payload.quality_score,
        had_rework=normalized_had_rework,
    )

    task.status = "done"

    existing = db.query(TaskOutcome).filter(TaskOutcome.task_id == task_id).first()

    if existing:
        existing.completed_at = payload.completed_at
        existing.finished_on_time = payload.finished_on_time
        existing.delay_hours = payload.delay_hours
        existing.quality_score = payload.quality_score
        existing.had_rework = normalized_had_rework
        existing.rework_count = normalized_rework_count
        existing.success_score = success_score
        existing.notes = payload.notes

        db.commit()
        db.refresh(existing)
        return existing

    outcome = TaskOutcome(
        task_id=task_id,
        completed_at=payload.completed_at,
        finished_on_time=payload.finished_on_time,
        delay_hours=payload.delay_hours,
        quality_score=payload.quality_score,
        had_rework=normalized_had_rework,
        rework_count=normalized_rework_count,
        success_score=success_score,
        notes=payload.notes,
    )

    db.add(outcome)
    db.commit()
    db.refresh(outcome)
    return outcome