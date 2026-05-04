from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.ml_baseline_service import (
    get_baseline_status,
    train_baseline_model_from_rows,
)
from app.services.training_dataset_service import build_training_dataset_rows

router = APIRouter(prefix="/ml-baseline", tags=["ML Baseline"])


@router.get("/status")
def baseline_status():
    return get_baseline_status()


@router.post("/train-from-history")
def train_baseline_from_history(db: Session = Depends(get_db)):
    rows = build_training_dataset_rows(db)

    if len(rows) < 30:
        raise HTTPException(
            status_code=400,
            detail="No hay suficientes registros históricos con outcome para entrenar el baseline.",
        )

    result = train_baseline_model_from_rows(
        rows=rows,
        project_id=None,
        project_name="NeuroKanban - entrenamiento desde histórico interno",
        source_name="historical_internal_data",
    )
    return result