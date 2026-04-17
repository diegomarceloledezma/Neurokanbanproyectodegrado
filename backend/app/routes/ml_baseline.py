from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.ml_baseline_service import (
    get_model_status,
    preview_predictions,
    train_baseline_model,
)

router = APIRouter(prefix="/ml/baseline", tags=["ML Baseline"])


@router.get("/status")
def baseline_status():
    return get_model_status()


@router.post("/train")
def train_baseline(
    project_id: int | None = Query(default=None),
    test_size: float = Query(default=0.25, ge=0.1, le=0.4),
    random_state: int = Query(default=42),
    db: Session = Depends(get_db),
):
    try:
        return train_baseline_model(
            db,
            project_id=project_id,
            test_size=test_size,
            random_state=random_state,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/preview")
def preview_baseline_predictions(
    project_id: int | None = Query(default=None),
    limit: int = Query(default=20, ge=5, le=100),
    db: Session = Depends(get_db),
):
    try:
        return preview_predictions(
            db,
            project_id=project_id,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc