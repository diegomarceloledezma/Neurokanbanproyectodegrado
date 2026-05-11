from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.routes.auth import get_current_user, has_any_role
from app.services.training_dataset_service import (
    build_clean_training_dataset_preview,
    build_clean_training_dataset_rows,
    build_recalibrated_training_dataset_preview,
    build_recalibrated_training_dataset_rows,
    build_training_dataset_preview,
    build_training_dataset_rows,
    build_training_growth_summary,
    build_trusted_training_dataset_preview,
    build_trusted_training_dataset_rows,
)

router = APIRouter(prefix="/training-data", tags=["Training Data"])


def _require_analytics_access(current_user: User) -> None:
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para consultar datos de entrenamiento",
        )


@router.get("/preview")
def get_training_data_preview(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analytics_access(current_user)
    return build_training_dataset_preview(db, limit=limit)


@router.get("/preview-cleaned")
def get_clean_training_data_preview(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analytics_access(current_user)
    return build_clean_training_dataset_preview(db, limit=limit)


@router.get("/preview-trusted")
def get_trusted_training_data_preview(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analytics_access(current_user)
    return build_trusted_training_dataset_preview(db, limit=limit)


@router.get("/preview-recalibrated")
def get_recalibrated_training_data_preview(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analytics_access(current_user)
    return build_recalibrated_training_dataset_preview(db, limit=limit)


@router.get("/rows")
def get_training_data_rows(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analytics_access(current_user)
    rows = build_training_dataset_rows(db)
    return {
        "total_rows": len(rows),
        "class_balance": {
            "negative_count": sum(1 for row in rows if int(row.get("success_label", 0)) == 0),
            "positive_count": sum(1 for row in rows if int(row.get("success_label", 0)) == 1),
        },
        "rows": rows[:limit],
    }


@router.get("/rows-cleaned")
def get_clean_training_data_rows(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analytics_access(current_user)
    dataset = build_clean_training_dataset_rows(db)
    rows = dataset["clean_rows"]
    return {
        "total_rows": len(rows),
        "class_balance": dataset["class_balance"],
        "rows": rows[:limit],
        "excluded_by_reason": dataset["excluded_by_reason"],
    }


@router.get("/rows-trusted")
def get_trusted_training_data_rows(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analytics_access(current_user)
    dataset = build_trusted_training_dataset_rows(db)
    rows = dataset["trusted_rows"]
    return {
        "total_rows": len(rows),
        "class_balance": dataset["class_balance"],
        "rows": rows[:limit],
        "excluded_by_reason": dataset["excluded_by_reason"],
    }


@router.get("/rows-recalibrated")
def get_recalibrated_training_data_rows(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analytics_access(current_user)
    dataset = build_recalibrated_training_dataset_rows(db)
    rows = dataset["recalibrated_rows"]
    return {
        "total_rows": len(rows),
        "class_balance": dataset["class_balance"],
        "repaired_snapshot_rows": dataset["repaired_snapshot_rows"],
        "rows": rows[:limit],
        "excluded_by_reason": dataset["excluded_by_reason"],
    }


@router.get("/growth-summary")
def get_training_growth_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analytics_access(current_user)
    return build_training_growth_summary(db)