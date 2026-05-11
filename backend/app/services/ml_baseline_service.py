from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    ExtraTreesClassifier,
    HistGradientBoostingClassifier,
    RandomForestClassifier,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
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
from app.services.training_dataset_service import (
    build_clean_training_dataset_rows,
    build_recalibrated_training_dataset_rows,
    build_trusted_training_dataset_rows,
)

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
    "historical_tasks_with_outcome",
    "historical_success_rate",
    "historical_avg_success_score",
    "historical_on_time_rate",
    "historical_quality_index",
    "historical_no_rework_rate",
    "same_task_type_history_count",
    "same_task_type_success_rate",
    "same_priority_history_count",
    "same_priority_success_rate",
    "recent_5_success_rate",
]

CATEGORICAL_FEATURES_FULL = [
    "source",
    "strategy",
    "priority_snapshot",
    "task_type_snapshot",
    "snapshot_quality",
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
    "historical_tasks_with_outcome",
    "historical_success_rate",
    "historical_avg_success_score",
    "historical_on_time_rate",
    "historical_quality_index",
    "historical_no_rework_rate",
    "same_task_type_success_rate",
    "same_priority_success_rate",
    "recent_5_success_rate",
]

CATEGORICAL_FEATURES_COMPACT = [
    "strategy",
    "priority_snapshot",
    "task_type_snapshot",
    "snapshot_quality",
]

NUMERIC_FEATURES_SOURCE_AWARE = [
    "recommendation_score",
    "workload_score",
    "skill_match_score",
    "availability_score",
    "performance_score",
    "current_load_snapshot",
    "availability_snapshot",
    "required_skills_count",
    "matching_ratio",
    "estimated_hours_snapshot",
    "complexity_snapshot",
    "historical_tasks_with_outcome",
    "historical_success_rate",
    "historical_avg_success_score",
    "historical_on_time_rate",
    "historical_quality_index",
    "historical_no_rework_rate",
    "same_task_type_history_count",
    "same_task_type_success_rate",
    "same_priority_history_count",
    "same_priority_success_rate",
    "recent_5_success_rate",
]

CATEGORICAL_FEATURES_SOURCE_AWARE = [
    "source",
    "strategy",
    "priority_snapshot",
    "task_type_snapshot",
    "snapshot_quality",
]

MIN_TEST_ROWS_FOR_CHAMPION = 40
MIN_ROC_AUC_FOR_CHAMPION = 0.70
MIN_BALANCED_ACCURACY_FOR_CHAMPION = 0.66


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

    if training_variant in {
        "trusted_source_aware_history",
        "recalibrated_source_aware_history",
    }:
        return NUMERIC_FEATURES_SOURCE_AWARE, CATEGORICAL_FEATURES_SOURCE_AWARE

    return NUMERIC_FEATURES_FULL, CATEGORICAL_FEATURES_FULL


def _probability_confidence_band(probability: float | None) -> str:
    if probability is None:
        return "sin_modelo"

    prob = max(0.0, min(1.0, float(probability)))
    distance = abs(prob - 0.5)

    if distance >= 0.30:
        return "alta"
    if distance >= 0.15:
        return "media"
    return "baja"


def _class_balance_from_series(y: pd.Series) -> dict[str, Any]:
    if y.empty:
        return {
            "negative_count": 0,
            "positive_count": 0,
            "minority_ratio_percent": 0.0,
            "assessment": "sin_datos",
        }

    negatives = int((y == 0).sum())
    positives = int((y == 1).sum())
    minority = min(negatives, positives)
    total = len(y)
    minority_ratio = round((minority / total) * 100, 2) if total > 0 else 0.0

    if minority_ratio >= 35:
        assessment = "alto"
    elif minority_ratio >= 20:
        assessment = "medio"
    else:
        assessment = "bajo"

    return {
        "negative_count": negatives,
        "positive_count": positives,
        "minority_ratio_percent": minority_ratio,
        "assessment": assessment,
    }


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
                "task_type_snapshot": task.task_type or "other",
                "snapshot_quality": "original",
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
                "historical_tasks_with_outcome": 0,
                "historical_success_rate": 50.0,
                "historical_avg_success_score": 60.0,
                "historical_on_time_rate": 50.0,
                "historical_quality_index": 60.0,
                "historical_no_rework_rate": 50.0,
                "same_task_type_history_count": 0,
                "same_task_type_success_rate": 50.0,
                "same_priority_history_count": 0,
                "same_priority_success_rate": 50.0,
                "recent_5_success_rate": 50.0,
                "finished_on_time": finished_on_time,
                "delay_hours": delay_hours,
                "quality_score": quality_score,
                "had_rework": had_rework,
                "success_score": success_score,
                "success_label": success_label,
            }
        )

    return pd.DataFrame(data)


def _build_preprocessor(
    *,
    numeric_features: list[str],
    categorical_features: list[str],
) -> ColumnTransformer:
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )


def _build_pipeline(
    *,
    model_name: str,
    numeric_features: list[str],
    categorical_features: list[str],
    random_state: int,
) -> Pipeline:
    preprocessor = _build_preprocessor(
        numeric_features=numeric_features,
        categorical_features=categorical_features,
    )

    if model_name == "LogisticRegression":
        classifier = LogisticRegression(
            max_iter=2500,
            class_weight="balanced",
            solver="liblinear",
            random_state=random_state,
        )
    elif model_name == "RandomForest":
        classifier = RandomForestClassifier(
            n_estimators=450,
            max_depth=None,
            min_samples_leaf=2,
            max_features="sqrt",
            class_weight="balanced",
            random_state=random_state,
            n_jobs=-1,
        )
    elif model_name == "ExtraTrees":
        classifier = ExtraTreesClassifier(
            n_estimators=500,
            max_depth=None,
            min_samples_leaf=2,
            max_features="sqrt",
            class_weight="balanced",
            random_state=random_state,
            n_jobs=-1,
        )
    elif model_name == "HistGradientBoosting":
        classifier = HistGradientBoostingClassifier(
            max_depth=6,
            learning_rate=0.05,
            max_iter=320,
            random_state=random_state,
        )
    else:
        raise ValueError(f"Modelo no soportado: {model_name}")

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )


def _extract_feature_importance(model: Pipeline) -> list[dict[str, float]]:
    preprocessor: ColumnTransformer = model.named_steps["preprocessor"]
    classifier = model.named_steps["classifier"]
    feature_names = list(preprocessor.get_feature_names_out())

    if hasattr(classifier, "coef_"):
        weights = classifier.coef_[0]
    elif hasattr(classifier, "feature_importances_"):
        weights = classifier.feature_importances_
    else:
        return []

    rows = []
    for name, weight in zip(feature_names, weights):
        rows.append(
            {
                "feature": name,
                "coefficient": round(float(weight), 6),
                "absolute_weight": round(abs(float(weight)), 6),
            }
        )

    rows.sort(key=lambda item: item["absolute_weight"], reverse=True)
    return rows[:20]


def _build_sample_weights(X_train: pd.DataFrame, y_train: pd.Series) -> list[float]:
    class_counts = y_train.value_counts().to_dict()
    strategy_counts = X_train["strategy"].fillna("NO_DEFINIDO").value_counts().to_dict()
    source_counts = (
        X_train["source"].fillna("NO_DEFINIDO").value_counts().to_dict()
        if "source" in X_train.columns
        else {}
    )

    total_rows = len(X_train)
    total_classes = max(len(class_counts), 1)
    total_strategies = max(len(strategy_counts), 1)
    total_sources = max(len(source_counts), 1) if source_counts else 1

    weights: list[float] = []

    for idx in X_train.index:
        row_class = int(y_train.loc[idx])
        row_strategy = X_train.loc[idx, "strategy"] if pd.notna(X_train.loc[idx, "strategy"]) else "NO_DEFINIDO"

        class_weight = total_rows / (total_classes * class_counts.get(row_class, 1))
        strategy_weight = total_rows / (total_strategies * strategy_counts.get(row_strategy, 1))

        if source_counts:
            row_source = X_train.loc[idx, "source"] if pd.notna(X_train.loc[idx, "source"]) else "NO_DEFINIDO"
            source_weight = total_rows / (total_sources * source_counts.get(row_source, 1))
            final_weight = (class_weight * 0.48) + (strategy_weight * 0.18) + (source_weight * 0.34)
        else:
            final_weight = (class_weight * 0.70) + (strategy_weight * 0.30)

        weights.append(float(final_weight))

    return weights


def build_feature_payload(
    *,
    source: str,
    strategy: str,
    priority_snapshot: str,
    task_type_snapshot: str,
    snapshot_quality: str,
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
    historical_tasks_with_outcome: int,
    historical_success_rate: float,
    historical_avg_success_score: float,
    historical_on_time_rate: float,
    historical_quality_index: float,
    historical_no_rework_rate: float,
    same_task_type_history_count: int,
    same_task_type_success_rate: float,
    same_priority_history_count: int,
    same_priority_success_rate: float,
    recent_5_success_rate: float,
) -> dict[str, Any]:
    return {
        "source": source,
        "strategy": strategy,
        "priority_snapshot": priority_snapshot,
        "task_type_snapshot": task_type_snapshot,
        "snapshot_quality": snapshot_quality,
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
        "historical_tasks_with_outcome": historical_tasks_with_outcome,
        "historical_success_rate": historical_success_rate,
        "historical_avg_success_score": historical_avg_success_score,
        "historical_on_time_rate": historical_on_time_rate,
        "historical_quality_index": historical_quality_index,
        "historical_no_rework_rate": historical_no_rework_rate,
        "same_task_type_history_count": same_task_type_history_count,
        "same_task_type_success_rate": same_task_type_success_rate,
        "same_priority_history_count": same_priority_history_count,
        "same_priority_success_rate": same_priority_success_rate,
        "recent_5_success_rate": recent_5_success_rate,
    }


def predict_success_probability_from_features(
    features: dict[str, Any],
    *,
    model: Pipeline | None = None,
) -> float | None:
    pipeline = model or load_baseline_model()
    metadata = load_baseline_metadata()

    if pipeline is None or metadata is None:
        return None

    numeric_features = metadata.get("numeric_features", [])
    categorical_features = metadata.get("categorical_features", [])
    expected_columns = numeric_features + categorical_features

    row = {column: features.get(column) for column in expected_columns}
    df = pd.DataFrame([row])

    try:
        probability = pipeline.predict_proba(df)[0][1]
        return round(float(probability), 4)
    except Exception:
        return None


def _safe_roc_auc(y_true: pd.Series, y_prob) -> float:
    try:
        return round(float(roc_auc_score(y_true, y_prob)), 4)
    except Exception:
        return 0.0


def _evaluate_candidate(
    *,
    model_name: str,
    pipeline: Pipeline,
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    sample_weights: list[float],
) -> dict[str, Any]:
    fit_kwargs = {"classifier__sample_weight": sample_weights}
    pipeline.fit(X_train, y_train, **fit_kwargs)

    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "balanced_accuracy": round(float(balanced_accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "roc_auc": _safe_roc_auc(y_test, y_prob),
    }

    selection_score = round(
        (metrics["roc_auc"] * 0.50)
        + (metrics["f1"] * 0.22)
        + (metrics["balanced_accuracy"] * 0.16)
        + (metrics["recall"] * 0.07)
        + (metrics["accuracy"] * 0.05),
        4,
    )

    return {
        "model_name": model_name,
        "pipeline": pipeline,
        "metrics": metrics,
        "selection_score": selection_score,
        "classification_report": classification_report(
            y_test,
            y_pred,
            output_dict=True,
            zero_division=0,
        ),
        "top_coefficients": _extract_feature_importance(pipeline),
    }


def _model_readiness(metrics: dict[str, float]) -> dict[str, Any]:
    roc_auc = metrics.get("roc_auc", 0.0)
    f1 = metrics.get("f1", 0.0)
    balanced_accuracy = metrics.get("balanced_accuracy", 0.0)

    if roc_auc >= 0.82 and f1 >= 0.70 and balanced_accuracy >= 0.70:
        confidence_band = "alta"
        recommended_usage = "produccion_supervisada"
    elif roc_auc >= 0.74 and f1 >= 0.60:
        confidence_band = "media"
        recommended_usage = "apoyo_a_decision"
    else:
        confidence_band = "baja"
        recommended_usage = "solo_como_senal_complementaria"

    return {
        "confidence_band": confidence_band,
        "recommended_usage": recommended_usage,
    }


def _score_from_metadata(metadata: dict[str, Any] | None) -> float:
    if not metadata:
        return 0.0

    metrics = metadata.get("metrics") or {}
    accuracy = float(metrics.get("accuracy") or 0.0)
    balanced_accuracy = float(metrics.get("balanced_accuracy") or 0.0)
    f1 = float(metrics.get("f1") or 0.0)
    roc_auc = float(metrics.get("roc_auc") or 0.0)
    recall = float(metrics.get("recall") or 0.0)

    return round(
        (roc_auc * 0.50)
        + (f1 * 0.22)
        + (balanced_accuracy * 0.16)
        + (recall * 0.07)
        + (accuracy * 0.05),
        4,
    )


def _source_diversity(rows: list[dict[str, Any]]) -> float:
    unique_sources = {
        str(row.get("source") or "").strip().lower()
        for row in rows
        if str(row.get("source") or "").strip()
    }
    if not unique_sources:
        return 0.0
    return min(len(unique_sources) / 3.0, 1.0)


def _champion_bonus(
    *,
    metadata: dict[str, Any],
    rows: list[dict[str, Any]],
    source_aware: bool,
) -> float:
    dataset_rows = int(metadata.get("dataset_rows") or 0)
    test_rows = int(metadata.get("test_rows") or 0)
    balance = metadata.get("class_balance") or {}
    minority_ratio = float(balance.get("minority_ratio_percent") or 0.0)

    holdout_bonus = min(test_rows / 250.0, 0.05)
    dataset_bonus = min(dataset_rows / 1000.0, 0.04)
    diversity_bonus = _source_diversity(rows) * 0.015 if source_aware else 0.0
    balance_bonus = 0.01 if minority_ratio >= 35 else 0.0

    return round(holdout_bonus + dataset_bonus + diversity_bonus + balance_bonus, 4)


def _champion_score(
    *,
    metadata: dict[str, Any],
    rows: list[dict[str, Any]],
    source_aware: bool,
) -> float:
    return round(
        _score_from_metadata(metadata)
        + _champion_bonus(metadata=metadata, rows=rows, source_aware=source_aware),
        4,
    )


def _champion_eligibility(metadata: dict[str, Any]) -> tuple[bool, list[str]]:
    reasons: list[str] = []

    metrics = metadata.get("metrics") or {}
    test_rows = int(metadata.get("test_rows") or 0)
    roc_auc = float(metrics.get("roc_auc") or 0.0)
    balanced_accuracy = float(metrics.get("balanced_accuracy") or 0.0)

    if test_rows < MIN_TEST_ROWS_FOR_CHAMPION:
        reasons.append("holdout_insuficiente")
    if roc_auc < MIN_ROC_AUC_FOR_CHAMPION:
        reasons.append("roc_auc_insuficiente")
    if balanced_accuracy < MIN_BALANCED_ACCURACY_FOR_CHAMPION:
        reasons.append("balanced_accuracy_insuficiente")

    return len(reasons) == 0, reasons


def _persist_artifacts(pipeline: Pipeline, metadata: dict[str, Any]) -> None:
    _ensure_artifacts_dir()
    joblib.dump(pipeline, MODEL_PATH)
    METADATA_PATH.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _train_pipeline_from_dataframe(
    *,
    df: pd.DataFrame,
    project_id: int | None,
    project_name: str | None,
    source_name: str,
    test_size: float,
    random_state: int,
    training_variant: str,
) -> tuple[dict[str, Any], Pipeline]:
    if df.empty:
        raise ValueError("No hay datos suficientes para entrenar el modelo")

    if "success_label" not in df.columns:
        raise ValueError("El dataset no contiene la variable objetivo success_label")

    numeric_features, categorical_features = _get_feature_sets(training_variant)
    feature_columns = numeric_features + categorical_features

    model_df = df[feature_columns + ["success_label"]].copy()

    X = model_df[feature_columns]
    y = model_df["success_label"].astype(int)

    if y.nunique() < 2:
        raise ValueError("Se requieren al menos dos clases para entrenar el modelo")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y if y.nunique() > 1 else None,
    )

    sample_weights = _build_sample_weights(X_train, y_train)

    candidate_names = [
        "LogisticRegression",
        "RandomForest",
        "ExtraTrees",
        "HistGradientBoosting",
    ]

    candidate_results: list[dict[str, Any]] = []
    best_candidate: dict[str, Any] | None = None

    for model_name in candidate_names:
        pipeline = _build_pipeline(
            model_name=model_name,
            numeric_features=numeric_features,
            categorical_features=categorical_features,
            random_state=random_state,
        )

        result = _evaluate_candidate(
            model_name=model_name,
            pipeline=pipeline,
            X_train=X_train,
            X_test=X_test,
            y_train=y_train,
            y_test=y_test,
            sample_weights=sample_weights,
        )
        candidate_results.append(result)

        if best_candidate is None or result["selection_score"] > best_candidate["selection_score"]:
            best_candidate = result

    if best_candidate is None:
        raise ValueError("No se pudo entrenar ningún modelo candidato")

    class_balance = _class_balance_from_series(y)
    label_counts = y.value_counts().to_dict()
    metrics = best_candidate["metrics"]

    metadata = {
        "model_type": best_candidate["model_name"],
        "target": "success_label",
        "project_id": project_id,
        "project_name": project_name,
        "training_source": source_name,
        "training_variant": training_variant,
        "dataset_rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "label_distribution": {str(k): int(v) for k, v in label_counts.items()},
        "class_balance": class_balance,
        "test_size": test_size,
        "random_state": random_state,
        "metrics": metrics,
        "model_readiness": _model_readiness(metrics),
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "top_coefficients": best_candidate["top_coefficients"],
        "classification_report": best_candidate["classification_report"],
        "selection_score": best_candidate["selection_score"],
        "candidate_models": [
            {
                "model_name": candidate["model_name"],
                "selection_score": candidate["selection_score"],
                "metrics": candidate["metrics"],
            }
            for candidate in sorted(candidate_results, key=lambda item: item["selection_score"], reverse=True)
        ],
    }

    return metadata, best_candidate["pipeline"]


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

    metadata, pipeline = _train_pipeline_from_dataframe(
        df=df,
        project_id=project_id,
        project_name=project_name,
        source_name="database_training_history",
        test_size=test_size,
        random_state=random_state,
        training_variant="raw_database",
    )

    _persist_artifacts(pipeline, metadata)
    metadata["promoted"] = True
    metadata["promotion_reason"] = "modelo_guardado"
    return metadata


def train_baseline_model_from_rows(
    *,
    rows: list[dict[str, Any]],
    project_id: int | None = None,
    project_name: str | None = None,
    source_name: str = "historical_internal_data",
    test_size: float = 0.25,
    random_state: int = 42,
    training_variant: str = "raw_rows",
    promote_only_if_better: bool = False,
) -> dict[str, Any]:
    df = pd.DataFrame(rows)

    metadata, pipeline = _train_pipeline_from_dataframe(
        df=df,
        project_id=project_id,
        project_name=project_name,
        source_name=source_name,
        test_size=test_size,
        random_state=random_state,
        training_variant=training_variant,
    )

    current_metadata = load_baseline_metadata()
    current_score = _score_from_metadata(current_metadata)
    candidate_score = _score_from_metadata(metadata)

    promoted = True
    promotion_reason = "modelo_guardado"

    if promote_only_if_better and current_metadata:
        eligible, reasons = _champion_eligibility(metadata)
        if not eligible:
            promoted = False
            promotion_reason = ",".join(reasons)
        elif candidate_score + 0.0001 < current_score + 0.008:
            promoted = False
            promotion_reason = "mejora_insuficiente_en_selection_score"

    if promoted:
        _persist_artifacts(pipeline, metadata)

    metadata["promoted"] = promoted
    metadata["promotion_reason"] = promotion_reason
    metadata["current_active_selection_score"] = current_score if current_metadata else None
    metadata["candidate_selection_score"] = candidate_score

    if current_metadata:
        metadata["current_active_model_type"] = current_metadata.get("model_type")
        metadata["current_active_training_variant"] = current_metadata.get("training_variant")

    return metadata


def _source_distribution(rows: list[dict[str, Any]]) -> dict[str, int]:
    result: dict[str, int] = {}
    for row in rows:
        key = str(row.get("source") or "NO_DEFINIDO")
        result[key] = result.get(key, 0) + 1
    return result


def _strategy_distribution(rows: list[dict[str, Any]]) -> dict[str, int]:
    result: dict[str, int] = {}
    for row in rows:
        key = str(row.get("strategy") or "NO_DEFINIDO")
        result[key] = result.get(key, 0) + 1
    return result


def _build_variant_result(
    *,
    variant_key: str,
    variant_label: str,
    training_variant: str,
    source_name: str,
    rows: list[dict[str, Any]],
    raw_rows: int,
    pipeline: Pipeline,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    source_aware = training_variant in {
        "trusted_source_aware_history",
        "recalibrated_source_aware_history",
    }
    eligible, eligibility_reasons = _champion_eligibility(metadata)
    champion_score = _champion_score(
        metadata=metadata,
        rows=rows,
        source_aware=source_aware,
    )

    return {
        "variant_key": variant_key,
        "variant_label": variant_label,
        "training_variant": training_variant,
        "training_source": source_name,
        "raw_reference_rows": raw_rows,
        "dataset_rows": len(rows),
        "source_distribution": _source_distribution(rows),
        "strategy_distribution": _strategy_distribution(rows),
        "metrics": metadata["metrics"],
        "selection_score": metadata["selection_score"],
        "champion_score": champion_score,
        "model_type": metadata["model_type"],
        "test_rows": metadata["test_rows"],
        "train_rows": metadata["train_rows"],
        "class_balance": metadata["class_balance"],
        "model_readiness": metadata["model_readiness"],
        "eligible_for_champion": eligible,
        "eligibility_reasons": eligibility_reasons,
        "_pipeline": pipeline,
        "_metadata": metadata,
    }


def revalidate_active_champion(
    db: Session,
    *,
    test_size: float = 0.25,
    random_state: int = 42,
) -> dict[str, Any]:
    current_metadata = load_baseline_metadata()

    clean_dataset = build_clean_training_dataset_rows(db)
    trusted_dataset = build_trusted_training_dataset_rows(db)
    recalibrated_dataset = build_recalibrated_training_dataset_rows(db)

    variants = [
        {
            "variant_key": "compact_cleaned",
            "variant_label": "Compacto limpio",
            "training_variant": "compact_cleaned_history",
            "source_name": "historical_internal_data_cleaned",
            "project_name": "NeuroKanban - candidato compacto limpio",
            "rows": clean_dataset["clean_rows"],
            "raw_rows": len(clean_dataset["raw_rows"]),
        },
        {
            "variant_key": "trusted_source_aware",
            "variant_label": "Trusted source-aware",
            "training_variant": "trusted_source_aware_history",
            "source_name": "historical_internal_data_trusted",
            "project_name": "NeuroKanban - candidato trusted source-aware",
            "rows": trusted_dataset["trusted_rows"],
            "raw_rows": len(trusted_dataset["raw_rows"]),
        },
        {
            "variant_key": "recalibrated_source_aware",
            "variant_label": "Recalibrado source-aware",
            "training_variant": "recalibrated_source_aware_history",
            "source_name": "historical_internal_data_recalibrated",
            "project_name": "NeuroKanban - candidato recalibrado source-aware",
            "rows": recalibrated_dataset["recalibrated_rows"],
            "raw_rows": len(recalibrated_dataset["raw_rows"]),
        },
    ]

    candidate_results: list[dict[str, Any]] = []
    skipped_variants: list[dict[str, Any]] = []

    for variant in variants:
        rows = variant["rows"]
        if len(rows) < 30:
            skipped_variants.append(
                {
                    "variant_key": variant["variant_key"],
                    "variant_label": variant["variant_label"],
                    "reason": "dataset_insuficiente",
                    "dataset_rows": len(rows),
                }
            )
            continue

        metadata, pipeline = _train_pipeline_from_dataframe(
            df=pd.DataFrame(rows),
            project_id=None,
            project_name=variant["project_name"],
            source_name=variant["source_name"],
            test_size=test_size,
            random_state=random_state,
            training_variant=variant["training_variant"],
        )

        candidate_results.append(
            _build_variant_result(
                variant_key=variant["variant_key"],
                variant_label=variant["variant_label"],
                training_variant=variant["training_variant"],
                source_name=variant["source_name"],
                rows=rows,
                raw_rows=variant["raw_rows"],
                pipeline=pipeline,
                metadata=metadata,
            )
        )

    eligible_candidates = [
        item for item in candidate_results if item["eligible_for_champion"]
    ]
    eligible_candidates.sort(
        key=lambda item: item["champion_score"],
        reverse=True,
    )

    promoted = False
    promotion_reason = "sin_cambios"
    champion_summary: dict[str, Any] | None = None

    if eligible_candidates:
        champion = eligible_candidates[0]
        champion_metadata = dict(champion["_metadata"])
        champion_metadata["champion_score"] = champion["champion_score"]
        champion_metadata["champion_variant_key"] = champion["variant_key"]
        champion_metadata["champion_variant_label"] = champion["variant_label"]

        _persist_artifacts(champion["_pipeline"], champion_metadata)
        promoted = True
        promotion_reason = "campeon_revalidado_y_promovido"

        champion_summary = {
            "variant_key": champion["variant_key"],
            "variant_label": champion["variant_label"],
            "training_variant": champion["training_variant"],
            "model_type": champion["model_type"],
            "dataset_rows": champion["dataset_rows"],
            "test_rows": champion["test_rows"],
            "selection_score": champion["selection_score"],
            "champion_score": champion["champion_score"],
            "metrics": champion["metrics"],
            "class_balance": champion["class_balance"],
        }
    else:
        promotion_reason = "ningun_candidato_elegible"

    clean_candidate_results = []
    for item in candidate_results:
        clean_candidate_results.append(
            {
                "variant_key": item["variant_key"],
                "variant_label": item["variant_label"],
                "training_variant": item["training_variant"],
                "training_source": item["training_source"],
                "raw_reference_rows": item["raw_reference_rows"],
                "dataset_rows": item["dataset_rows"],
                "source_distribution": item["source_distribution"],
                "strategy_distribution": item["strategy_distribution"],
                "metrics": item["metrics"],
                "selection_score": item["selection_score"],
                "champion_score": item["champion_score"],
                "model_type": item["model_type"],
                "test_rows": item["test_rows"],
                "train_rows": item["train_rows"],
                "class_balance": item["class_balance"],
                "model_readiness": item["model_readiness"],
                "eligible_for_champion": item["eligible_for_champion"],
                "eligibility_reasons": item["eligibility_reasons"],
            }
        )

    clean_candidate_results.sort(key=lambda item: item["champion_score"], reverse=True)

    return {
        "message": "Revalidación del campeón ejecutada correctamente",
        "promoted": promoted,
        "promotion_reason": promotion_reason,
        "current_active_before": current_metadata,
        "champion": champion_summary,
        "candidates": clean_candidate_results,
        "skipped_variants": skipped_variants,
        "criteria": {
            "min_test_rows": MIN_TEST_ROWS_FOR_CHAMPION,
            "min_roc_auc": MIN_ROC_AUC_FOR_CHAMPION,
            "min_balanced_accuracy": MIN_BALANCED_ACCURACY_FOR_CHAMPION,
        },
    }


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
        prob = round(float(row["predicted_success_probability"]), 4)
        records.append(
            {
                "assignment_decision_id": int(row["assignment_decision_id"]),
                "task_id": int(row["task_id"]),
                "source": row["source"],
                "strategy": row["strategy"],
                "priority_snapshot": row["priority_snapshot"],
                "task_type_snapshot": row.get("task_type_snapshot"),
                "recommendation_score": round(float(row["recommendation_score"] or 0), 2),
                "matching_ratio": round(float(row["matching_ratio"] or 0), 2),
                "current_load_snapshot": round(float(row["current_load_snapshot"] or 0), 2),
                "availability_snapshot": round(float(row["availability_snapshot"] or 0), 2),
                "historical_success_rate": round(float(row.get("historical_success_rate") or 0), 2),
                "recent_5_success_rate": round(float(row.get("recent_5_success_rate") or 0), 2),
                "same_task_type_success_rate": round(float(row.get("same_task_type_success_rate") or 0), 2),
                "actual_success_label": int(row["success_label"]),
                "predicted_label": int(row["predicted_label"]),
                "predicted_success_probability": prob,
                "prediction_confidence": _probability_confidence_band(prob),
            }
        )

    return {
        "project_id": project_id,
        "rows_evaluated": len(records),
        "predictions": records,
    }