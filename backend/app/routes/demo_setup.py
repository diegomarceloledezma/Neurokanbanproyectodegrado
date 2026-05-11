from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.routes.auth import get_current_user, has_any_role
from app.services.demo_setup_service import create_demo_scenario, create_training_benchmark_batch

router = APIRouter(prefix="/demo-setup", tags=["Demo Setup"])


@router.post("/scenario")
def generate_demo_scenario(
    source_project_id: int = Query(default=1, ge=1),
    seed: int = Query(default=42),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin"):
        raise HTTPException(
            status_code=403,
            detail="Solo un administrador puede generar escenarios demo",
        )

    try:
        result = create_demo_scenario(
            db,
            source_project_id=source_project_id,
            seed=seed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "message": "Escenario demo creado correctamente",
        "project_id": result.project_id,
        "project_name": result.project_name,
        "source_project_id": result.source_project_id,
        "members_copied": result.members_copied,
        "background_tasks_created": result.background_tasks_created,
        "demo_tasks_created": result.demo_tasks_created,
        "demo_tasks": [
            {
                "id": item.id,
                "title": item.title,
                "task_type": item.task_type,
                "recommended_strategy": item.recommended_strategy,
            }
            for item in result.demo_tasks
        ],
    }


@router.post("/training-batch")
def generate_training_benchmark_batch(
    source_project_id: int = Query(default=1, ge=1),
    scenario_count: int = Query(default=4, ge=1, le=50),
    seed: int = Query(default=42),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_any_role(current_user, "admin"):
        raise HTTPException(
            status_code=403,
            detail="Solo un administrador puede generar batches benchmark",
        )

    try:
        result = create_training_benchmark_batch(
            db,
            source_project_id=source_project_id,
            scenario_count=scenario_count,
            seed=seed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "message": "Batch benchmark de entrenamiento creado correctamente",
        "source_project_id": result.source_project_id,
        "scenarios_created": result.scenarios_created,
        "projects_created": result.projects_created,
        "tasks_created": result.tasks_created,
        "assignment_histories_created": result.assignment_histories_created,
        "outcomes_created": result.outcomes_created,
        "created_project_ids": result.created_project_ids[:20],
        "sample_tasks": result.sample_tasks[:10],
    }