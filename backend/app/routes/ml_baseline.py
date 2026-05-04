from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.ml_baseline_service import (
    get_baseline_status,
    train_baseline_model_from_rows,
)
from app.services.training_dataset_service import (
    build_clean_training_dataset_rows,
    build_training_dataset_rows,
)

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
        training_variant="raw_history",
    )
    return result


@router.post("/train-from-history-cleaned")
def train_baseline_from_history_cleaned(db: Session = Depends(get_db)):
    dataset = build_clean_training_dataset_rows(db)
    rows = dataset["clean_rows"]

    if len(rows) < 30:
        raise HTTPException(
            status_code=400,
            detail="No hay suficientes registros limpios para entrenar el baseline.",
        )

    result = train_baseline_model_from_rows(
        rows=rows,
        project_id=None,
        project_name="NeuroKanban - entrenamiento desde histórico interno depurado",
        source_name="historical_internal_data_cleaned",
        training_variant="cleaned_history",
    )
    result["excluded_by_reason"] = dataset["excluded_by_reason"]
    result["raw_rows"] = len(dataset["raw_rows"])
    result["clean_rows"] = len(dataset["clean_rows"])
    result["excluded_rows"] = len(dataset["excluded_rows"])
    return result


@router.post("/train-from-history-compact-cleaned")
def train_baseline_from_history_compact_cleaned(db: Session = Depends(get_db)):
    dataset = build_clean_training_dataset_rows(db)
    rows = dataset["clean_rows"]

    if len(rows) < 30:
        raise HTTPException(
            status_code=400,
            detail="No hay suficientes registros limpios para entrenar el baseline compacto.",
        )

    result = train_baseline_model_from_rows(
        rows=rows,
        project_id=None,
        project_name="NeuroKanban - entrenamiento compacto depurado",
        source_name="historical_internal_data_cleaned",
        training_variant="compact_cleaned_history",
    )
    result["excluded_by_reason"] = dataset["excluded_by_reason"]
    result["raw_rows"] = len(dataset["raw_rows"])
    result["clean_rows"] = len(dataset["clean_rows"])
    result["excluded_rows"] = len(dataset["excluded_rows"])
    return result