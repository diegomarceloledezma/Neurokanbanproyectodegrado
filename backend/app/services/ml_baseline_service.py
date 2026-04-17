from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sqlalchemy.orm import Session

from app.models import Project, Task, TaskAssignmentHistory, TaskOutcome


ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "ml_artifacts"
MODEL_PATH = ARTIFACTS_DIR / "baseline_success_model.joblib"
METADATA_PATH = ARTIFACTS_DIR / "baseline_success_model_metadata.json"

NUMERIC_FEATURES = [
    "recommendation_score",
    "workload_score",
    "skill_match_score",
    "availability_score",
    "performance_score",
    "current_load_snapshot",
    "availability_snapshot",
    "active_tasks_snapshot",
    "required_skills_count",
    "matching_skills_count",
    "matching_ratio",
    "estimated_hours_snapshot",
    "complexity_snapshot",
]

CATEGORICAL_FEATURES = [
    "source",
    "strategy",
    "priority_snapshot",
]


def _ensure_artifacts_dir() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except Exception:
        return None


def _compute_success_score_from_outcome(
    *,
    finished_on_time: bool | None,
    delay_hours: float | None,
    quality_score: int | None,
    had_rework: bool | None,
) -> float:
    score = 0.0

    if finished_on_time:
        score += 35
    else:
        delay = float(delay_hours or 0.0)
        score += max(0.0, 15 - delay * 1.8)

    quality = int(quality_score or 0)
    score += quality * 12

    if had_rework:
        score -= 8
    else:
        score += 10

    return round(max(0.0, min(100.0, score)), 2)


def _compute_success_label(success_score: float) -> int:
    return 1 if float(success_score) >= 65.0 else 0


def fetch_training_dataframe(db: Session, project_id: int | None = None) -> pd.DataFrame:
    query = (
        db.query(TaskAssignmentHistory, TaskOutcome, Task)
        .join(Task, Task.id == TaskAssignmentHistory.task_id)
        .join(TaskOutcome, TaskOutcome.task_id == Task.id)
    )

    if project_id is not None:
        query = query.filter(Task.project_id == project_id)

    rows = query.order_by(TaskAssignmentHistory.id.asc()).all()

    data: list[dict[str, Any]] = []
    for decision, outcome, task in rows:
        stored_success_score = _safe_float(outcome.success_score)

        finished_on_time = outcome.finished_on_time
        delay_hours = _safe_float(outcome.delay_hours) or 0.0
        quality_score = _safe_int(outcome.quality_score) or 0
        had_rework = bool(outcome.had_rework)

        success_score = (
            stored_success_score
            if stored_success_score is not None
            else _compute_success_score_from_outcome(
                finished_on_time=finished_on_time,
                delay_hours=delay_hours,
                quality_score=quality_score,
                had_rework=had_rework,
            )
        )

        success_label = _compute_success_label(success_score)

        data.append(
            {
                "assignment_decision_id": decision.id,
                "task_id": task.id,
                "project_id": task.project_id,
                "assigned_to": decision.assigned_to,
                "source": decision.source or "manual",
                "strategy": decision.strategy or "balance",
                "priority_snapshot": decision.priority_snapshot or task.priority or "medium",
                "recommendation_score": _safe_float(decision.recommendation_score),
                "workload_score": _safe_float(decision.workload_score),
                "skill_match_score": _safe_float(decision.skill_match_score),
                "availability_score": _safe_float(decision.availability_score),
                "performance_score": _safe_float(decision.performance_score),
                "current_load_snapshot": _safe_float(decision.current_load_snapshot),
                "availability_snapshot": _safe_float(decision.availability_snapshot),
                "active_tasks_snapshot": _safe_int(decision.active_tasks_snapshot),
                "required_skills_count": _safe_int(decision.required_skills_count),
                "matching_skills_count": _safe_int(decision.matching_skills_count),
                "matching_ratio": _safe_float(decision.matching_ratio),
                "estimated_hours_snapshot": _safe_float(decision.estimated_hours_snapshot),
                "complexity_snapshot": _safe_int(decision.complexity_snapshot),
                "finished_on_time": finished_on_time,
                "delay_hours": delay_hours,
                "quality_score": quality_score,
                "had_rework": had_rework,
                "success_score": success_score,
                "success_label": success_label,
            }
        )

    return pd.DataFrame(data)


def _build_pipeline() -> Pipeline:
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, NUMERIC_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES),
        ]
    )

    classifier = LogisticRegression(
        max_iter=1200,
        class_weight="balanced",
        solver="liblinear",
        random_state=42,
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )

    return pipeline


def _extract_feature_importance(model: Pipeline) -> list[dict[str, float]]:
    preprocessor: ColumnTransformer = model.named_steps["preprocessor"]
    classifier: LogisticRegression = model.named_steps["classifier"]

    feature_names = list(preprocessor.get_feature_names_out())
    coefficients = classifier.coef_[0]

    rows = []
    for name, coef in zip(feature_names, coefficients):
        rows.append(
            {
                "feature": name,
                "coefficient": round(float(coef), 6),
                "absolute_weight": round(abs(float(coef)), 6),
            }
        )

    rows.sort(key=lambda item: item["absolute_weight"], reverse=True)
    return rows[:15]


def train_baseline_model(
    db: Session,
    *,
    project_id: int | None = None,
    test_size: float = 0.25,
    random_state: int = 42,
) -> dict[str, Any]:
    df = fetch_training_dataframe(db, project_id=project_id)

    if df.empty:
        raise ValueError("No hay datos suficientes para entrenar el modelo baseline")

    if "success_label" not in df.columns:
        raise ValueError("El dataset no contiene la variable objetivo success_label")

    label_counts = df["success_label"].value_counts().to_dict()
    if len(label_counts) < 2:
        raise ValueError("El dataset necesita ejemplos de al menos dos clases para entrenar")

    if len(df) < 30:
        raise ValueError("Se requieren al menos 30 registros para entrenar un baseline defendible")

    feature_columns = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X = df[feature_columns].copy()
    y = df["success_label"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
    )

    pipeline = _build_pipeline()
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, y_prob)), 4),
    }

    _ensure_artifacts_dir()
    joblib.dump(pipeline, MODEL_PATH)

    project_name = None
    if project_id is not None:
        project = db.query(Project).filter(Project.id == project_id).first()
        project_name = project.name if project else None

    metadata = {
        "model_type": "LogisticRegression",
        "target": "success_label",
        "project_id": project_id,
        "project_name": project_name,
        "dataset_rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "label_distribution": {str(k): int(v) for k, v in label_counts.items()},
        "test_size": test_size,
        "random_state": random_state,
        "metrics": metrics,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "top_coefficients": _extract_feature_importance(pipeline),
        "classification_report": classification_report(
            y_test,
            y_pred,
            output_dict=True,
            zero_division=0,
        ),
    }

    METADATA_PATH.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return metadata


def load_baseline_model() -> Pipeline | None:
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)


def load_baseline_metadata() -> dict[str, Any] | None:
    if not METADATA_PATH.exists():
        return None
    return json.loads(METADATA_PATH.read_text(encoding="utf-8"))


def get_model_status() -> dict[str, Any]:
    metadata = load_baseline_metadata()
    return {
        "model_exists": MODEL_PATH.exists(),
        "metadata_exists": METADATA_PATH.exists(),
        "model_path": str(MODEL_PATH),
        "metadata_path": str(METADATA_PATH),
        "metadata": metadata,
    }


def preview_predictions(
    db: Session,
    *,
    project_id: int | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    model = load_baseline_model()
    if model is None:
        raise ValueError("El modelo baseline todavía no fue entrenado")

    df = fetch_training_dataframe(db, project_id=project_id)
    if df.empty:
        raise ValueError("No hay datos disponibles para previsualizar")

    feature_columns = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    preview_df = df.tail(limit).copy()
    probabilities = model.predict_proba(preview_df[feature_columns])[:, 1]
    predicted_labels = model.predict(preview_df[feature_columns])

    preview_df["predicted_success_probability"] = probabilities
    preview_df["predicted_label"] = predicted_labels

    records = []
    for _, row in preview_df.sort_values("assignment_decision_id", ascending=False).iterrows():
        records.append(
            {
                "assignment_decision_id": int(row["assignment_decision_id"]),
                "task_id": int(row["task_id"]),
                "source": row["source"],
                "strategy": row["strategy"],
                "priority_snapshot": row["priority_snapshot"],
                "recommendation_score": round(float(row["recommendation_score"] or 0), 2),
                "matching_ratio": round(float(row["matching_ratio"] or 0), 2),
                "current_load_snapshot": round(float(row["current_load_snapshot"] or 0), 2),
                "availability_snapshot": round(float(row["availability_snapshot"] or 0), 2),
                "actual_success_label": int(row["success_label"]),
                "predicted_label": int(row["predicted_label"]),
                "predicted_success_probability": round(float(row["predicted_success_probability"]), 4),
            }
        )

    return {
        "project_id": project_id,
        "rows_evaluated": len(records),
        "predictions": records,
    }