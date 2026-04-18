from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.demo_setup_service import create_demo_scenario

router = APIRouter(prefix="/demo-setup", tags=["Demo Setup"])


@router.post("/scenario")
def generate_demo_scenario(
    source_project_id: int = Query(default=1, ge=1),
    seed: int = Query(default=42),
    db: Session = Depends(get_db),
):
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