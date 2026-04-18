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
from app.services.task_insight_engine import infer_task_insights

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("/tasks/{task_id}", response_model=TaskRecommendationResponse)
def get_task_recommendations(
    task_id: int,
    strategy: str = Query(default="balance"),
    mode: str = Query(default="hybrid"),
    db: Session = Depends(get_db),
):
    if strategy not in ALLOWED_STRATEGIES:
        raise HTTPException(status_code=400, detail="Estrategia no válida")
    if mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail="Modo no válido")

    task = load_task_or_none(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    response = build_task_recommendations_response(db, task, strategy, mode)
    if not response:
        raise HTTPException(status_code=404, detail="No hay integrantes disponibles para recomendar")

    return response


@router.get("/tasks/{task_id}/simulation", response_model=TaskSimulationResponse)
def get_task_simulation(
    task_id: int,
    strategy: str = Query(default="balance"),
    mode: str = Query(default="hybrid"),
    db: Session = Depends(get_db),
):
    if strategy not in ALLOWED_STRATEGIES:
        raise HTTPException(status_code=400, detail="Estrategia no válida")
    if mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail="Modo no válido")

    task = load_task_or_none(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    response = build_task_simulation_response(db, task, strategy, mode)
    if not response:
        raise HTTPException(status_code=404, detail="No hay integrantes disponibles para simular")

    return response


@router.get("/tasks/{task_id}/insights", response_model=TaskInsightResponse)
def get_task_insights(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = load_task_or_none(db, task_id)
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