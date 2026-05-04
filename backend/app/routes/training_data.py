from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.training_dataset_service import (
    build_training_dataset_preview,
    build_training_dataset_rows,
)

router = APIRouter(prefix="/training-data", tags=["Training Data"])


@router.get("/preview")
def get_training_data_preview(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return build_training_dataset_preview(db, limit=limit)


@router.get("/rows")
def get_training_data_rows(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    rows = build_training_dataset_rows(db)
    return {
        "total_rows": len(rows),
        "rows": rows[:limit],
    }