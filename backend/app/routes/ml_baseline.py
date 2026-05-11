from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.routes.auth import get_current_user, has_any_role
from app.models import User
from app.services.ml_baseline_service import (
    get_baseline_status,
    revalidate_active_champion,
    train_baseline_model_from_rows,
)
from app.services.training_dataset_service import (
    build_clean_training_dataset_rows,
    build_recalibrated_training_dataset_rows,
    build_training_dataset_rows,
    build_trusted_training_dataset_rows,
)

router = APIRouter(prefix="/ml-baseline", tags=["ML Baseline"])


def _require_model_access(current_user: User) -> None:
    if not has_any_role(current_user, "admin", "leader"):
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para acceder al módulo de modelos",
        )


@router.get("/status")
def baseline_status(current_user: User = Depends(get_current_user)):
    _require_model_access(current_user)
    return get_baseline_status()


@router.post("/train-from-history")
def train_baseline_from_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_model_access(current_user)

    rows = build_training_dataset_rows(db)

    if len(rows) < 30:
        raise HTTPException(
            status_code=400,
            detail="No hay suficientes registros históricos con outcome para entrenar el baseline.",
        )

    return train_baseline_model_from_rows(
        rows=rows,
        project_id=None,
        project_name="NeuroKanban - entrenamiento desde histórico interno",
        source_name="historical_internal_data",
        training_variant="raw_history",
    )


@router.post("/train-from-history-cleaned")
def train_baseline_from_history_cleaned(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_model_access(current_user)

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
    result["class_balance"] = dataset["class_balance"]
    return result


@router.post("/train-from-history-compact-cleaned")
def train_baseline_from_history_compact_cleaned(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_model_access(current_user)

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
    result["class_balance"] = dataset["class_balance"]
    return result


@router.post("/train-from-history-trusted-source-aware")
def train_baseline_from_history_trusted_source_aware(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_model_access(current_user)

    dataset = build_trusted_training_dataset_rows(db)
    rows = dataset["trusted_rows"]

    if len(rows) < 30:
        raise HTTPException(
            status_code=400,
            detail="No hay suficientes registros trusted para entrenar el baseline source-aware.",
        )

    result = train_baseline_model_from_rows(
        rows=rows,
        project_id=None,
        project_name="NeuroKanban - entrenamiento trusted source-aware",
        source_name="historical_internal_data_trusted",
        training_variant="trusted_source_aware_history",
        promote_only_if_better=True,
    )
    result["excluded_by_reason"] = dataset["excluded_by_reason"]
    result["raw_rows"] = len(dataset["raw_rows"])
    result["trusted_rows"] = len(dataset["trusted_rows"])
    result["excluded_rows"] = len(dataset["excluded_rows"])
    result["class_balance"] = dataset["class_balance"]
    return result


@router.post("/train-from-history-recalibrated-source-aware")
def train_baseline_from_history_recalibrated_source_aware(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_model_access(current_user)

    dataset = build_recalibrated_training_dataset_rows(db)
    rows = dataset["recalibrated_rows"]

    if len(rows) < 30:
        raise HTTPException(
            status_code=400,
            detail="No hay suficientes registros recalibrados para entrenar el baseline source-aware.",
        )

    result = train_baseline_model_from_rows(
        rows=rows,
        project_id=None,
        project_name="NeuroKanban - entrenamiento recalibrado source-aware",
        source_name="historical_internal_data_recalibrated",
        training_variant="recalibrated_source_aware_history",
        promote_only_if_better=True,
    )
    result["excluded_by_reason"] = dataset["excluded_by_reason"]
    result["raw_rows"] = len(dataset["raw_rows"])
    result["base_clean_rows"] = len(dataset["base_clean_rows"])
    result["recalibrated_rows"] = len(dataset["recalibrated_rows"])
    result["excluded_rows"] = len(dataset["excluded_rows"])
    result["repaired_snapshot_rows"] = dataset["repaired_snapshot_rows"]
    result["class_balance"] = dataset["class_balance"]
    return result


@router.post("/revalidate-champion")
def revalidate_champion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_model_access(current_user)
    return revalidate_active_champion(db)