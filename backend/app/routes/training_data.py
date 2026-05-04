from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.training_dataset_service import (
    build_clean_training_dataset_preview,
    build_clean_training_dataset_rows,
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


@router.get("/preview-cleaned")
def get_clean_training_data_preview(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return build_clean_training_dataset_preview(db, limit=limit)


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


@router.get("/rows-cleaned")
def get_clean_training_data_rows(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    dataset = build_clean_training_dataset_rows(db)
    rows = dataset["clean_rows"]
    return {
        "total_rows": len(rows),
        "rows": rows[:limit],
        "excluded_by_reason": dataset["excluded_by_reason"],
    }