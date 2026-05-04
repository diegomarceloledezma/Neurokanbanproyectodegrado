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
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sqlalchemy.orm import Session

from app.models import Project, Task, TaskAssignmentHistory, TaskOutcome

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "ml_artifacts"
MODEL_PATH = ARTIFACTS_DIR / "baseline_success_model.joblib"
METADATA_PATH = ARTIFACTS_DIR / "baseline_success_model_metadata.json"

NUMERIC_FEATURES_FULL = [
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

CATEGORICAL_FEATURES_FULL = [
    "source",
    "strategy",
    "priority_snapshot",
]

NUMERIC_FEATURES_COMPACT = [
    "recommendation_score",
    "skill_match_score",
    "performance_score",
    "current_load_snapshot",
    "required_skills_count",
    "matching_ratio",
    "estimated_hours_snapshot",
    "complexity_snapshot",
]

CATEGORICAL_FEATURES_COMPACT = [
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


def _get_feature_sets(training_variant: str) -> tuple[list[str], list[str]]:
    if training_variant == "compact_cleaned_history":
        return NUMERIC_FEATURES_COMPACT, CATEGORICAL_FEATURES_COMPACT

    return NUMERIC_FEATURES_FULL, CATEGORICAL_FEATURES_FULL


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


def _build_pipeline(
    *,
    numeric_features: list[str],
    categorical_features: list[str],
) -> Pipeline:
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
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
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    classifier = LogisticRegression(
        max_iter=1500,
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


def _build_sample_weights(X_train: pd.DataFrame, y_train: pd.Series) -> list[float]:
    class_counts = y_train.value_counts().to_dict()
    strategy_counts = X_train["strategy"].fillna("NO_DEFINIDO").value_counts().to_dict()

    total_rows = len(X_train)
    total_classes = max(len(class_counts), 1)
    total_strategies = max(len(strategy_counts), 1)

    weights: list[float] = []

    for idx in X_train.index:
        row_class = int(y_train.loc[idx])
        row_strategy = X_train.loc[idx, "strategy"] if pd.notna(X_train.loc[idx, "strategy"]) else "NO_DEFINIDO"

        class_weight = total_rows / (total_classes * class_counts.get(row_class, 1))
        strategy_weight = total_rows / (total_strategies * strategy_counts.get(row_strategy, 1))

        final_weight = (class_weight * 0.7) + (strategy_weight * 0.3)
        weights.append(float(final_weight))

    return weights


def build_feature_payload(
    *,
    source: str,
    strategy: str,
    priority_snapshot: str,
    recommendation_score: float,
    workload_score: float,
    skill_match_score: float,
    availability_score: float,
    performance_score: float,
    current_load_snapshot: float,
    availability_snapshot: float,
    active_tasks_snapshot: int,
    required_skills_count: int,
    matching_skills_count: int,
    matching_ratio: float,
    estimated_hours_snapshot: float | None,
    complexity_snapshot: int,
) -> dict[str, Any]:
    return {
        "source": source,
        "strategy": strategy,
        "priority_snapshot": priority_snapshot,
        "recommendation_score": recommendation_score,
        "workload_score": workload_score,
        "skill_match_score": skill_match_score,
        "availability_score": availability_score,
        "performance_score": performance_score,
        "current_load_snapshot": current_load_snapshot,
        "availability_snapshot": availability_snapshot,
        "active_tasks_snapshot": active_tasks_snapshot,
        "required_skills_count": required_skills_count,
        "matching_skills_count": matching_skills_count,
        "matching_ratio": matching_ratio,
        "estimated_hours_snapshot": estimated_hours_snapshot,
        "complexity_snapshot": complexity_snapshot,
    }


def predict_success_probability_from_features(
    features: dict[str, Any],
    *,
    model: Pipeline | None = None,
) -> float | None:
    model_to_use = model or load_baseline_model()
    metadata = load_baseline_metadata()

    if model_to_use is None or metadata is None:
        return None

    numeric_features = metadata.get("numeric_features", [])
    categorical_features = metadata.get("categorical_features", [])
    active_features = numeric_features + categorical_features

    feature_row = {}
    for feature in active_features:
        feature_row[feature] = features.get(feature)

    df = pd.DataFrame([feature_row])
    probability = model_to_use.predict_proba(df)[0][1]
    return round(float(probability), 4)


def _train_pipeline_from_dataframe(
    df: pd.DataFrame,
    *,
    project_id: int | None,
    project_name: str | None,
    source_name: str,
    test_size: float = 0.25,
    random_state: int = 42,
    training_variant: str = "raw",
) -> dict[str, Any]:
    if df.empty:
        raise ValueError("No hay datos suficientes para entrenar el modelo baseline")

    if "success_label" not in df.columns:
        raise ValueError("El dataset no contiene la variable objetivo success_label")

    label_counts = df["success_label"].value_counts().to_dict()
    if len(label_counts) < 2:
        raise ValueError("El dataset necesita ejemplos de al menos dos clases para entrenar")

    if len(df) < 30:
        raise ValueError("Se requieren al menos 30 registros para entrenar un baseline defendible")

    numeric_features, categorical_features = _get_feature_sets(training_variant)
    feature_columns = numeric_features + categorical_features

    X = df[feature_columns].copy()
    y = df["success_label"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
    )

    sample_weights = _build_sample_weights(X_train, y_train)

    pipeline = _build_pipeline(
        numeric_features=numeric_features,
        categorical_features=categorical_features,
    )
    pipeline.fit(X_train, y_train, classifier__sample_weight=sample_weights)

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

    metadata = {
        "model_type": "LogisticRegression",
        "target": "success_label",
        "project_id": project_id,
        "project_name": project_name,
        "training_source": source_name,
        "training_variant": training_variant,
        "dataset_rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "label_distribution": {str(k): int(v) for k, v in label_counts.items()},
        "test_size": test_size,
        "random_state": random_state,
        "metrics": metrics,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
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


def train_baseline_model(
    db: Session,
    *,
    project_id: int | None = None,
    test_size: float = 0.25,
    random_state: int = 42,
) -> dict[str, Any]:
    df = fetch_training_dataframe(db, project_id=project_id)

    project_name = None
    if project_id is not None:
        project = db.query(Project).filter(Project.id == project_id).first()
        project_name = project.name if project else None

    return _train_pipeline_from_dataframe(
        df=df,
        project_id=project_id,
        project_name=project_name,
        source_name="database_training_history",
        test_size=test_size,
        random_state=random_state,
        training_variant="raw_database",
    )


def train_baseline_model_from_rows(
    *,
    rows: list[dict[str, Any]],
    project_id: int | None = None,
    project_name: str | None = None,
    source_name: str = "historical_internal_data",
    test_size: float = 0.25,
    random_state: int = 42,
    training_variant: str = "raw_rows",
) -> dict[str, Any]:
    df = pd.DataFrame(rows)

    return _train_pipeline_from_dataframe(
        df=df,
        project_id=project_id,
        project_name=project_name,
        source_name=source_name,
        test_size=test_size,
        random_state=random_state,
        training_variant=training_variant,
    )


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


def get_baseline_status() -> dict[str, Any]:
    return get_model_status()


def preview_predictions(
    db: Session,
    *,
    project_id: int | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    model = load_baseline_model()
    metadata = load_baseline_metadata()

    if model is None or metadata is None:
        raise ValueError("El modelo baseline todavía no fue entrenado")

    df = fetch_training_dataframe(db, project_id=project_id)
    if df.empty:
        raise ValueError("No hay datos disponibles para previsualizar")

    feature_columns = metadata.get("numeric_features", []) + metadata.get("categorical_features", [])
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