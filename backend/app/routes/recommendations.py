from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import (
    TaskInsightResponse,
    TaskRecommendationResponse,
    TaskSimulationResponse,
)
from app.services.recommendation_engine import (
    ALLOWED_MODES,
    ALLOWED_STRATEGIES,
    build_task_recommendations_response,
    build_task_simulation_response,
    load_task_or_none,
)
from app.services.task_insights_service import build_task_insight_response

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("/tasks/{task_id}", response_model=TaskRecommendationResponse)
def get_task_recommendations(
    task_id: int,
    strategy: str = Query(default="balance"),
    mode: str = Query(default="hybrid"),
    db: Session = Depends(get_db),
):
    if strategy not in ALLOWED_STRATEGIES:
        raise HTTPException(
            status_code=400,
            detail=f"Estrategia inválida. Usa una de: {', '.join(sorted(ALLOWED_STRATEGIES))}",
        )

    if mode not in ALLOWED_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Modo inválido. Usa uno de: {', '.join(sorted(ALLOWED_MODES))}",
        )

    task = load_task_or_none(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    response = build_task_recommendations_response(db, task, strategy, mode)
    if not response:
        raise HTTPException(
            status_code=404,
            detail="No se encontraron integrantes elegibles para recomendar",
        )

    return response


@router.get("/tasks/{task_id}/simulation", response_model=TaskSimulationResponse)
def get_task_simulation(
    task_id: int,
    strategy: str = Query(default="balance"),
    mode: str = Query(default="hybrid"),
    db: Session = Depends(get_db),
):
    if strategy not in ALLOWED_STRATEGIES:
        raise HTTPException(
            status_code=400,
            detail=f"Estrategia inválida. Usa una de: {', '.join(sorted(ALLOWED_STRATEGIES))}",
        )

    if mode not in ALLOWED_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Modo inválido. Usa uno de: {', '.join(sorted(ALLOWED_MODES))}",
        )

    task = load_task_or_none(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    response = build_task_simulation_response(db, task, strategy, mode)
    if not response:
        raise HTTPException(
            status_code=404,
            detail="No se encontraron integrantes elegibles para simular",
        )

    return response


@router.get("/tasks/{task_id}/insights", response_model=TaskInsightResponse)
def get_task_insights(task_id: int, db: Session = Depends(get_db)):
    task = load_task_or_none(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    return build_task_insight_response(task)