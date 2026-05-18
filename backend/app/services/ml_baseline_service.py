from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    brier_score_loss,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sqlalchemy.orm import Session

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "ml_artifacts"
MODEL_PATH = ARTIFACTS_DIR / "baseline_success_model.joblib"
METADATA_PATH = ARTIFACTS_DIR / "baseline_success_model_metadata.json"

NUMERIC_FEATURES_CORE = [
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

NUMERIC_FEATURES_HISTORY = [
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

CATEGORICAL_FEATURES_BASE = [
    "strategy",
    "priority_snapshot",
]

CATEGORICAL_FEATURES_EXTENDED = [
    "source",
    "strategy",
    "priority_snapshot",
    "task_type_snapshot",
    "snapshot_quality",
]

WEAK_SEGMENT_BOOSTS = {
    "strategy": {
        "urgency": 1.35,
        "learning": 1.10,
    },
    "source": {
        "benchmark_batch": 1.30,
    },
    "task_type": {
        "bug": 1.35,
        "design": 1.15,
    },
}

DEFAULT_STRATEGY_THRESHOLDS = {
    "balance": 0.50,
    "efficiency": 0.53,
    "urgency": 0.58,
    "learning": 0.55,
}


def _ensure_artifacts_dir() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except Exception:
        return default


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(value, high))


def _json_ready(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_ready(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    if isinstance(value, tuple):
        return [_json_ready(item) for item in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    return value


def _get_feature_sets(training_variant: str) -> tuple[list[str], list[str]]:
    base_numeric = list(NUMERIC_FEATURES_CORE)
    history_numeric = list(NUMERIC_FEATURES_HISTORY)

    if training_variant in {
        "compact_cleaned_history",
        "trusted_source_aware_history",
        "recalibrated_source_aware_history",
    }:
        numeric_features = base_numeric + history_numeric
        categorical_features = list(CATEGORICAL_FEATURES_EXTENDED)
        return numeric_features, categorical_features

    return base_numeric, list(CATEGORICAL_FEATURES_BASE)


def _probability_confidence_band(probability: float | None) -> str:
    if probability is None:
        return "sin_modelo"

    prob = _clamp(float(probability), 0.0, 1.0)
    distance = abs(prob - 0.5)

    if distance >= 0.30:
        return "alta"
    if distance >= 0.15:
        return "media"
    return "baja"


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
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ],
        sparse_threshold=0.0,
    )


def _build_pipeline(
    *,
    numeric_features: list[str],
    categorical_features: list[str],
    classifier,
) -> Pipeline:
    preprocessor = _build_preprocessor(
        numeric_features=numeric_features,
        categorical_features=categorical_features,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )


def _candidate_classifiers() -> list[tuple[str, Any]]:
    return [
        (
            "RandomForest",
            RandomForestClassifier(
                n_estimators=320,
                max_depth=10,
                min_samples_leaf=2,
                class_weight="balanced_subsample",
                random_state=42,
                n_jobs=-1,
            ),
        ),
        (
            "ExtraTrees",
            ExtraTreesClassifier(
                n_estimators=360,
                max_depth=12,
                min_samples_leaf=2,
                class_weight="balanced_subsample",
                random_state=42,
                n_jobs=-1,
            ),
        ),
        (
            "GradientBoosting",
            GradientBoostingClassifier(
                n_estimators=180,
                learning_rate=0.045,
                max_depth=2,
                subsample=0.88,
                random_state=42,
            ),
        ),
        (
            "LogisticRegression",
            LogisticRegression(
                max_iter=2000,
                class_weight="balanced",
                solver="liblinear",
                random_state=42,
            ),
        ),
    ]


def _extract_feature_importance(model: Pipeline) -> list[dict[str, float]]:
    preprocessor: ColumnTransformer = model.named_steps["preprocessor"]
    classifier = model.named_steps["classifier"]

    try:
        feature_names = list(preprocessor.get_feature_names_out())
    except Exception:
        return []

    rows: list[dict[str, float]] = []

    if hasattr(classifier, "feature_importances_"):
        importances = getattr(classifier, "feature_importances_")
        for name, importance in zip(feature_names, importances):
            rows.append(
                {
                    "feature": name,
                    "coefficient": round(float(importance), 6),
                    "absolute_weight": round(abs(float(importance)), 6),
                }
            )
    elif hasattr(classifier, "coef_"):
        coefficients = classifier.coef_[0]
        for name, coef in zip(feature_names, coefficients):
            rows.append(
                {
                    "feature": name,
                    "coefficient": round(float(coef), 6),
                    "absolute_weight": round(abs(float(coef)), 6),
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
    task_type_counts = (
        X_train["task_type_snapshot"].fillna("NO_DEFINIDO").value_counts().to_dict()
        if "task_type_snapshot" in X_train.columns
        else {}
    )

    total_rows = len(X_train)
    total_classes = max(len(class_counts), 1)
    total_strategies = max(len(strategy_counts), 1)
    total_sources = max(len(source_counts), 1) if source_counts else 1
    total_task_types = max(len(task_type_counts), 1) if task_type_counts else 1

    weights: list[float] = []

    for idx in X_train.index:
        row_class = int(y_train.loc[idx])
        row_strategy = (
            X_train.loc[idx, "strategy"]
            if pd.notna(X_train.loc[idx, "strategy"])
            else "NO_DEFINIDO"
        )
        row_source = (
            X_train.loc[idx, "source"]
            if "source" in X_train.columns and pd.notna(X_train.loc[idx, "source"])
            else "NO_DEFINIDO"
        )
        row_task_type = (
            X_train.loc[idx, "task_type_snapshot"]
            if "task_type_snapshot" in X_train.columns and pd.notna(X_train.loc[idx, "task_type_snapshot"])
            else "NO_DEFINIDO"
        )

        class_weight = total_rows / (total_classes * class_counts.get(row_class, 1))
        strategy_weight = total_rows / (
            total_strategies * strategy_counts.get(row_strategy, 1)
        )
        source_weight = (
            total_rows / (total_sources * source_counts.get(row_source, 1))
            if source_counts
            else 1.0
        )
        task_type_weight = (
            total_rows / (total_task_types * task_type_counts.get(row_task_type, 1))
            if task_type_counts
            else 1.0
        )

        final_weight = (
            (class_weight * 0.52)
            + (strategy_weight * 0.20)
            + (source_weight * 0.14)
            + (task_type_weight * 0.14)
        )

        final_weight *= WEAK_SEGMENT_BOOSTS["strategy"].get(str(row_strategy), 1.0)
        final_weight *= WEAK_SEGMENT_BOOSTS["source"].get(str(row_source), 1.0)
        final_weight *= WEAK_SEGMENT_BOOSTS["task_type"].get(str(row_task_type), 1.0)

        weights.append(float(final_weight))

    return weights


def _binary_metrics(y_true, y_pred, y_prob) -> dict[str, float]:
    metrics: dict[str, float] = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "balanced_accuracy": round(float(balanced_accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
    }

    try:
        metrics["roc_auc"] = round(float(roc_auc_score(y_true, y_prob)), 4)
    except Exception:
        metrics["roc_auc"] = 0.0

    return metrics


def _metrics_at_threshold(y_true, y_prob, threshold: float) -> dict[str, float]:
    y_pred = (np.array(y_prob) >= threshold).astype(int)
    return _binary_metrics(y_true, y_pred, y_prob)


def _threshold_analysis(y_true, y_prob) -> dict[str, Any]:
    thresholds = [
        0.25,
        0.30,
        0.35,
        0.40,
        0.45,
        0.50,
        0.55,
        0.60,
        0.65,
        0.70,
        0.75,
    ]
    evaluations: list[dict[str, Any]] = []

    best_f1_item = None
    best_balanced_item = None
    best_operating_item = None

    for threshold in thresholds:
        metrics = _metrics_at_threshold(y_true, y_prob, threshold)
        operating_score = (metrics["f1"] * 0.52) + (metrics["balanced_accuracy"] * 0.48)
        item = {
            "threshold": round(float(threshold), 2),
            "metrics": metrics,
            "operating_score": round(float(operating_score), 4),
        }
        evaluations.append(item)

        if best_f1_item is None or metrics["f1"] > best_f1_item["metrics"]["f1"]:
            best_f1_item = item

        if (
            best_balanced_item is None
            or metrics["balanced_accuracy"]
            > best_balanced_item["metrics"]["balanced_accuracy"]
        ):
            best_balanced_item = item

        if (
            best_operating_item is None
            or item["operating_score"] > best_operating_item["operating_score"]
        ):
            best_operating_item = item

    default_item = next(item for item in evaluations if item["threshold"] == 0.5)
    selected_item = best_operating_item or default_item

    return {
        "default_threshold": 0.5,
        "default_metrics": default_item["metrics"],
        "best_f1_threshold": best_f1_item["threshold"] if best_f1_item else 0.5,
        "best_f1_metrics": best_f1_item["metrics"] if best_f1_item else {},
        "best_balanced_threshold": (
            best_balanced_item["threshold"] if best_balanced_item else 0.5
        ),
        "best_balanced_metrics": (
            best_balanced_item["metrics"] if best_balanced_item else {}
        ),
        "best_operating_threshold": selected_item["threshold"],
        "best_operating_metrics": selected_item["metrics"],
        "thresholding_strategy": "grid_search_f1_balanced_accuracy",
        "grid": evaluations,
    }


def _calibration_summary(y_true, y_prob) -> dict[str, Any]:
    y_true_arr = np.array(y_true, dtype=int)
    y_prob_arr = np.array(y_prob, dtype=float)

    try:
        brier = round(float(brier_score_loss(y_true_arr, y_prob_arr)), 4)
    except Exception:
        brier = None

    bins = np.linspace(0.0, 1.0, 6)
    bucket_rows: list[dict[str, Any]] = []
    calibration_error = 0.0
    total = max(len(y_true_arr), 1)

    for start, end in zip(bins[:-1], bins[1:]):
        if end >= 1.0:
            mask = (y_prob_arr >= start) & (y_prob_arr <= end)
        else:
            mask = (y_prob_arr >= start) & (y_prob_arr < end)

        indices = np.where(mask)[0]
        support = len(indices)
        if support == 0:
            continue

        bucket_probs = y_prob_arr[indices]
        bucket_true = y_true_arr[indices]

        mean_pred = float(bucket_probs.mean())
        actual_rate = float(bucket_true.mean())
        gap = abs(mean_pred - actual_rate)
        calibration_error += gap * (support / total)

        bucket_rows.append(
            {
                "bucket": f"{start:.1f}-{end:.1f}",
                "support": int(support),
                "mean_predicted_probability": round(mean_pred, 4),
                "actual_positive_rate": round(actual_rate, 4),
                "absolute_gap": round(gap, 4),
            }
        )

    return {
        "brier_score": brier,
        "expected_calibration_error": round(float(calibration_error), 4),
        "buckets": bucket_rows,
    }


def _probability_separation_summary(y_true, y_prob) -> dict[str, Any]:
    y_true_arr = np.array(y_true, dtype=int)
    y_prob_arr = np.array(y_prob, dtype=float)

    positive_probs = y_prob_arr[y_true_arr == 1]
    negative_probs = y_prob_arr[y_true_arr == 0]

    if len(positive_probs) == 0 or len(negative_probs) == 0:
        return {
            "positive_mean_probability": None,
            "negative_mean_probability": None,
            "separation_gap": None,
            "assessment": "sin_datos_suficientes",
        }

    positive_mean = float(positive_probs.mean())
    negative_mean = float(negative_probs.mean())
    gap = positive_mean - negative_mean

    if gap >= 0.32:
        assessment = "alta"
    elif gap >= 0.20:
        assessment = "media"
    else:
        assessment = "baja"

    return {
        "positive_mean_probability": round(positive_mean, 4),
        "negative_mean_probability": round(negative_mean, 4),
        "separation_gap": round(float(gap), 4),
        "assessment": assessment,
    }


def _cross_validation_summary(
    *,
    X: pd.DataFrame,
    y: pd.Series,
    numeric_features: list[str],
    categorical_features: list[str],
    classifier,
    random_state: int = 42,
) -> dict[str, Any]:
    class_counts = y.value_counts().to_dict()
    min_class_support = min(class_counts.values()) if class_counts else 0

    if min_class_support < 2:
        return {
            "folds": 0,
            "metrics_mean": {},
            "metrics_std": {},
        }

    folds = min(5, int(min_class_support))
    if folds < 2:
        return {
            "folds": 0,
            "metrics_mean": {},
            "metrics_std": {},
        }

    splitter = StratifiedKFold(
        n_splits=folds,
        shuffle=True,
        random_state=random_state,
    )

    collected: dict[str, list[float]] = {
        "accuracy": [],
        "balanced_accuracy": [],
        "precision": [],
        "recall": [],
        "f1": [],
        "roc_auc": [],
    }

    for train_idx, test_idx in splitter.split(X, y):
        X_train = X.iloc[train_idx].copy()
        X_test = X.iloc[test_idx].copy()
        y_train = y.iloc[train_idx].copy()
        y_test = y.iloc[test_idx].copy()

        model = _build_pipeline(
            numeric_features=numeric_features,
            categorical_features=categorical_features,
            classifier=clone(classifier),
        )

        sample_weights = _build_sample_weights(X_train, y_train)
        model.fit(X_train, y_train, classifier__sample_weight=sample_weights)

        y_prob = model.predict_proba(X_test)[:, 1]
        fold_threshold_summary = _threshold_analysis(y_test, y_prob)
        fold_threshold = float(fold_threshold_summary.get("best_operating_threshold") or 0.5)
        y_pred = (np.array(y_prob) >= fold_threshold).astype(int)

        fold_metrics = _binary_metrics(y_test, y_pred, y_prob)
        for key, value in fold_metrics.items():
            collected[key].append(float(value))

    metrics_mean = {
        key: round(float(np.mean(values)), 4) if values else 0.0
        for key, values in collected.items()
    }
    metrics_std = {
        key: round(float(np.std(values)), 4) if values else 0.0
        for key, values in collected.items()
    }

    return {
        "folds": folds,
        "metrics_mean": metrics_mean,
        "metrics_std": metrics_std,
    }


def _segment_group_metrics(group: pd.DataFrame) -> dict[str, Any]:
    y_true = group["actual_label"].astype(int).tolist()
    y_prob = group["predicted_probability"].astype(float).tolist()
    y_pred = group["predicted_label"].astype(int).tolist()

    metrics = _binary_metrics(y_true, y_pred, y_prob)
    positive_rate = round(float(np.mean(y_true)), 4) if y_true else 0.0

    return {
        "support": int(len(group)),
        "positive_rate": positive_rate,
        "metrics": metrics,
    }


def _segment_performance(
    *,
    X_test: pd.DataFrame,
    y_test,
    y_prob,
    y_pred,
) -> dict[str, list[dict[str, Any]]]:
    eval_df = X_test.copy()
    eval_df["actual_label"] = np.array(y_test).astype(int)
    eval_df["predicted_probability"] = np.array(y_prob).astype(float)
    eval_df["predicted_label"] = np.array(y_pred).astype(int)

    output: dict[str, list[dict[str, Any]]] = {
        "by_strategy": [],
        "by_source": [],
        "by_task_type": [],
    }

    segment_map = {
        "by_strategy": "strategy",
        "by_source": "source",
        "by_task_type": "task_type_snapshot",
    }

    for output_key, column in segment_map.items():
        if column not in eval_df.columns:
            continue

        rows: list[dict[str, Any]] = []
        grouped = eval_df.groupby(column, dropna=False)

        for label, group in grouped:
            if len(group) < 5:
                continue

            metrics = _segment_group_metrics(group)
            rows.append(
                {
                    "label": str(label if label not in (None, "") else "NO_DEFINIDO"),
                    **metrics,
                }
            )

        rows.sort(key=lambda item: item["support"], reverse=True)
        output[output_key] = rows[:10]

    return output


def _strategy_thresholds_from_segments(segment_performance: dict[str, Any]) -> dict[str, float]:
    thresholds = dict(DEFAULT_STRATEGY_THRESHOLDS)
    strategy_rows = segment_performance.get("by_strategy", []) or []

    for row in strategy_rows:
        label = str(row.get("label") or "")
        if label not in thresholds:
            continue

        metrics = row.get("metrics", {}) or {}
        support = int(row.get("support") or 0)
        balanced = float(metrics.get("balanced_accuracy") or 0.0)
        roc_auc = float(metrics.get("roc_auc") or 0.0)

        if support < 8:
            thresholds[label] = round(thresholds[label] + 0.02, 2)
            continue

        if balanced < 0.60 or roc_auc < 0.68:
            thresholds[label] = round(min(0.70, thresholds[label] + 0.05), 2)
        elif balanced < 0.68:
            thresholds[label] = round(min(0.68, thresholds[label] + 0.03), 2)
        elif balanced >= 0.75 and roc_auc >= 0.78:
            thresholds[label] = round(max(0.45, thresholds[label] - 0.02), 2)

    return thresholds


def _segment_robustness_summary(segment_performance: dict[str, Any]) -> dict[str, Any]:
    weak_segments: dict[str, list[str]] = {
        "strategy": [],
        "source": [],
        "task_type": [],
    }
    stable_segments: dict[str, list[str]] = {
        "strategy": [],
        "source": [],
        "task_type": [],
    }

    mapping = {
        "strategy": segment_performance.get("by_strategy", []) or [],
        "source": segment_performance.get("by_source", []) or [],
        "task_type": segment_performance.get("by_task_type", []) or [],
    }

    for key, rows in mapping.items():
        for row in rows:
            label = str(row.get("label") or "NO_DEFINIDO")
            support = int(row.get("support") or 0)
            metrics = row.get("metrics", {}) or {}
            balanced = float(metrics.get("balanced_accuracy") or 0.0)
            roc_auc = float(metrics.get("roc_auc") or 0.0)

            if support >= 5 and (balanced < 0.60 or roc_auc < 0.68):
                weak_segments[key].append(label)
            elif support >= 8 and balanced >= 0.72 and roc_auc >= 0.75:
                stable_segments[key].append(label)

    return {
        "weak_segments": weak_segments,
        "stable_segments": stable_segments,
        "strategy_thresholds": _strategy_thresholds_from_segments(segment_performance),
    }


def _evaluation_notes(
    *,
    holdout_metrics: dict[str, float],
    cross_validation: dict[str, Any],
    calibration_summary: dict[str, Any],
    segment_performance: dict[str, Any],
    segment_robustness_summary: dict[str, Any],
) -> list[str]:
    notes: list[str] = []

    if holdout_metrics.get("roc_auc", 0.0) < 0.80:
        notes.append("El ROC AUC todavía admite mejora para separar mejor casos exitosos y no exitosos.")

    if holdout_metrics.get("balanced_accuracy", 0.0) < 0.72:
        notes.append("La balanced accuracy aún sugiere margen de mejora en el equilibrio entre clases.")

    cv_mean = cross_validation.get("metrics_mean", {})
    cv_std = cross_validation.get("metrics_std", {})

    if cv_mean:
        if cv_mean.get("roc_auc", 0.0) + 0.0001 < holdout_metrics.get("roc_auc", 0.0) - 0.04:
            notes.append("El desempeño en validación cruzada es inferior al holdout; revisar estabilidad del modelo.")

        if cv_std.get("f1", 0.0) > 0.08:
            notes.append("La variabilidad del F1 entre folds es moderada; conviene seguir fortaleciendo el dataset.")

    brier = calibration_summary.get("brier_score")
    ece = calibration_summary.get("expected_calibration_error")
    if brier is not None and brier > 0.20:
        notes.append("La calibración probabilística todavía es mejorable según el Brier Score.")
    if ece is not None and ece > 0.12:
        notes.append("Existen desajustes entre probabilidad predicha y tasa real en algunos buckets.")

    for segment_key in ["by_strategy", "by_source", "by_task_type"]:
        segment_rows = segment_performance.get(segment_key, [])
        weak_segments = [
            row
            for row in segment_rows
            if row["support"] >= 5 and row["metrics"].get("balanced_accuracy", 0.0) < 0.60
        ]
        if weak_segments:
            notes.append(f"Hay segmentos débiles en {segment_key.replace('by_', '')}; revisar cobertura y balance local.")
            break

    weak_strategy_segments = (segment_robustness_summary.get("weak_segments", {}) or {}).get("strategy", [])
    if weak_strategy_segments:
        notes.append(
            "Estrategias con robustez débil detectada: " + ", ".join(weak_strategy_segments[:3]) + "."
        )

    return notes[:7]


def _readiness_from_diagnostics(
    *,
    holdout_metrics: dict[str, float],
    cross_validation: dict[str, Any],
    calibration_summary: dict[str, Any],
) -> dict[str, str]:
    roc_auc = float(holdout_metrics.get("roc_auc") or 0.0)
    f1 = float(holdout_metrics.get("f1") or 0.0)
    balanced = float(holdout_metrics.get("balanced_accuracy") or 0.0)

    cv_mean = cross_validation.get("metrics_mean", {}) or {}
    cv_roc_auc = float(cv_mean.get("roc_auc") or 0.0)
    cv_f1 = float(cv_mean.get("f1") or 0.0)

    brier = calibration_summary.get("brier_score")
    brier_value = float(brier) if brier is not None else 1.0

    if (
        roc_auc >= 0.82
        and f1 >= 0.70
        and balanced >= 0.72
        and cv_roc_auc >= 0.78
        and cv_f1 >= 0.68
        and brier_value <= 0.22
    ):
        return {
            "confidence_band": "alta",
            "recommended_usage": "produccion_supervisada",
        }

    if (
        roc_auc >= 0.74
        and f1 >= 0.62
        and balanced >= 0.68
        and cv_roc_auc >= 0.70
        and cv_f1 >= 0.58
    ):
        return {
            "confidence_band": "media",
            "recommended_usage": "apoyo_a_decision",
        }

    return {
        "confidence_band": "baja",
        "recommended_usage": "solo_como_senal_complementaria",
    }


def _selection_score(
    *,
    holdout_metrics: dict[str, float],
    cross_validation: dict[str, Any],
    calibration_summary: dict[str, Any],
    segment_robustness_summary: dict[str, Any],
) -> float:
    cv_mean = cross_validation.get("metrics_mean", {}) or {}
    brier = calibration_summary.get("brier_score")
    ece = calibration_summary.get("expected_calibration_error")

    calibration_quality = 0.0
    if brier is not None:
        calibration_quality += max(0.0, 1.0 - float(brier))
    if ece is not None:
        calibration_quality += max(0.0, 1.0 - float(ece))
    calibration_quality = calibration_quality / 2 if calibration_quality > 0 else 0.0

    weak_segments = segment_robustness_summary.get("weak_segments", {}) or {}
    stable_segments = segment_robustness_summary.get("stable_segments", {}) or {}
    weak_count = sum(len(items) for items in weak_segments.values())
    stable_count = sum(len(items) for items in stable_segments.values())
    robustness_bonus = max(0.0, min(0.04, stable_count * 0.005))
    robustness_penalty = max(0.0, min(0.06, weak_count * 0.01))

    score = (
        float(holdout_metrics.get("roc_auc") or 0.0) * 0.25
        + float(holdout_metrics.get("f1") or 0.0) * 0.18
        + float(holdout_metrics.get("balanced_accuracy") or 0.0) * 0.15
        + float(holdout_metrics.get("accuracy") or 0.0) * 0.05
        + float(cv_mean.get("roc_auc") or 0.0) * 0.16
        + float(cv_mean.get("f1") or 0.0) * 0.10
        + float(cv_mean.get("balanced_accuracy") or 0.0) * 0.06
        + float(calibration_quality) * 0.05
        + robustness_bonus
        - robustness_penalty
    )

    return round(score, 4)


def _prepare_dataframe(
    rows: list[dict[str, Any]],
    training_variant: str,
) -> tuple[pd.DataFrame, list[str], list[str]]:
    df = pd.DataFrame(rows)

    if df.empty:
        raise ValueError("No hay datos suficientes para entrenar el modelo baseline")

    if "success_label" not in df.columns:
        raise ValueError("El dataset no contiene la variable objetivo success_label")

    numeric_features, categorical_features = _get_feature_sets(training_variant)
    feature_columns = numeric_features + categorical_features

    for column in feature_columns:
        if column not in df.columns:
            df[column] = None

    return df, numeric_features, categorical_features


def _fit_single_candidate(
    *,
    df: pd.DataFrame,
    numeric_features: list[str],
    categorical_features: list[str],
    classifier_name: str,
    classifier,
    project_id: int | None,
    project_name: str | None,
    source_name: str,
    test_size: float,
    random_state: int,
    training_variant: str,
) -> dict[str, Any]:
    label_counts = df["success_label"].astype(int).value_counts().to_dict()
    if len(label_counts) < 2:
        raise ValueError("El dataset necesita ejemplos de al menos dos clases para entrenar")

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

    pipeline = _build_pipeline(
        numeric_features=numeric_features,
        categorical_features=categorical_features,
        classifier=clone(classifier),
    )

    sample_weights = _build_sample_weights(X_train, y_train)
    pipeline.fit(X_train, y_train, classifier__sample_weight=sample_weights)

    y_prob = pipeline.predict_proba(X_test)[:, 1]
    threshold_analysis = _threshold_analysis(y_test, y_prob)
    operating_threshold = float(threshold_analysis.get("best_operating_threshold") or 0.5)
    y_pred = (np.array(y_prob) >= operating_threshold).astype(int)

    metrics = _binary_metrics(y_test, y_pred, y_prob)
    default_threshold_metrics = threshold_analysis.get("default_metrics", {})
    probability_separation = _probability_separation_summary(y_test, y_prob)
    cross_validation = _cross_validation_summary(
        X=X,
        y=y,
        numeric_features=numeric_features,
        categorical_features=categorical_features,
        classifier=clone(classifier),
        random_state=random_state,
    )
    calibration_summary = _calibration_summary(y_test, y_prob)
    segment_performance = _segment_performance(
        X_test=X_test,
        y_test=y_test,
        y_prob=y_prob,
        y_pred=y_pred,
    )
    segment_robustness_summary = _segment_robustness_summary(segment_performance)
    model_readiness = _readiness_from_diagnostics(
        holdout_metrics=metrics,
        cross_validation=cross_validation,
        calibration_summary=calibration_summary,
    )
    selection_score = _selection_score(
        holdout_metrics=metrics,
        cross_validation=cross_validation,
        calibration_summary=calibration_summary,
        segment_robustness_summary=segment_robustness_summary,
    )
    evaluation_notes = _evaluation_notes(
        holdout_metrics=metrics,
        cross_validation=cross_validation,
        calibration_summary=calibration_summary,
        segment_performance=segment_performance,
        segment_robustness_summary=segment_robustness_summary,
    )

    negative_count = int(label_counts.get(0, 0))
    positive_count = int(label_counts.get(1, 0))
    minority_ratio = round((min(negative_count, positive_count) / max(len(df), 1)) * 100, 2)

    metadata = {
        "model_type": classifier_name,
        "target": "success_label",
        "project_id": project_id,
        "project_name": project_name,
        "training_source": source_name,
        "training_variant": training_variant,
        "dataset_rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "label_distribution": {str(k): int(v) for k, v in label_counts.items()},
        "class_balance": {
            "negative_count": negative_count,
            "positive_count": positive_count,
            "minority_ratio_percent": minority_ratio,
            "assessment": (
                "alto"
                if minority_ratio >= 35
                else "medio"
                if minority_ratio >= 20
                else "bajo"
            ),
        },
        "test_size": test_size,
        "random_state": random_state,
        "metrics": metrics,
        "default_threshold_metrics": default_threshold_metrics,
        "operating_threshold": operating_threshold,
        "thresholding_strategy": threshold_analysis.get("thresholding_strategy"),
        "probability_separation": probability_separation,
        "model_readiness": model_readiness,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "top_coefficients": _extract_feature_importance(pipeline),
        "classification_report": classification_report(
            y_test,
            y_pred,
            output_dict=True,
            zero_division=0,
        ),
        "cross_validation": cross_validation,
        "calibration_summary": calibration_summary,
        "threshold_analysis": threshold_analysis,
        "segment_performance": segment_performance,
        "segment_robustness_summary": segment_robustness_summary,
        "strategy_thresholds": segment_robustness_summary.get("strategy_thresholds", DEFAULT_STRATEGY_THRESHOLDS),
        "evaluation_notes": evaluation_notes,
        "selection_score": selection_score,
    }

    return {
        "pipeline": pipeline,
        "metadata": _json_ready(metadata),
    }


def _current_active_selection_score() -> float | None:
    metadata = load_baseline_metadata()
    if not metadata:
        return None

    try:
        return float(metadata.get("selection_score"))
    except Exception:
        return None


def _attach_active_model_context(
    metadata: dict[str, Any],
    current_metadata: dict[str, Any] | None,
    *,
    promoted: bool,
) -> dict[str, Any]:
    previous_active_selection_score = (
        float(current_metadata.get("selection_score") or 0.0)
        if current_metadata and current_metadata.get("selection_score") is not None
        else None
    )
    previous_active_model_type = current_metadata.get("model_type") if current_metadata else None
    previous_active_training_variant = (
        current_metadata.get("training_variant") if current_metadata else None
    )

    metadata["previous_active_selection_score"] = previous_active_selection_score
    metadata["previous_active_model_type"] = previous_active_model_type
    metadata["previous_active_training_variant"] = previous_active_training_variant

    if promoted:
        metadata["current_active_selection_score"] = metadata.get("selection_score")
        metadata["candidate_selection_score"] = metadata.get("selection_score")
        metadata["current_active_model_type"] = metadata.get("model_type")
        metadata["current_active_training_variant"] = metadata.get("training_variant")
        metadata["active_model_synced"] = True
    else:
        metadata["current_active_selection_score"] = previous_active_selection_score
        metadata["candidate_selection_score"] = metadata.get("selection_score")
        metadata["current_active_model_type"] = previous_active_model_type
        metadata["current_active_training_variant"] = previous_active_training_variant
        metadata["active_model_synced"] = False

    return metadata


def _can_promote_candidate(
    *,
    candidate_metadata: dict[str, Any],
    current_metadata: dict[str, Any] | None,
) -> tuple[bool, str]:
    candidate_test_rows = int(candidate_metadata.get("test_rows") or 0)
    candidate_metrics = candidate_metadata.get("metrics", {}) or {}
    candidate_cv = candidate_metadata.get("cross_validation", {}) or {}
    candidate_brier = (
        candidate_metadata.get("calibration_summary", {}) or {}
    ).get("brier_score")

    if candidate_test_rows < 24:
        return False, "holdout_insuficiente"

    if float(candidate_metrics.get("roc_auc") or 0.0) < 0.72:
        return False, "roc_auc_insuficiente_para_promocion"

    if float(candidate_metrics.get("balanced_accuracy") or 0.0) < 0.68:
        return False, "balanced_accuracy_insuficiente"

    if float((candidate_cv.get("metrics_mean", {}) or {}).get("roc_auc") or 0.0) < 0.68:
        return False, "cross_validation_insuficiente"

    if candidate_brier is not None and float(candidate_brier) > 0.24:
        return False, "calibracion_insuficiente"

    if not current_metadata:
        return True, "modelo_guardado"

    current_score = float(current_metadata.get("selection_score") or 0.0)
    candidate_score = float(candidate_metadata.get("selection_score") or 0.0)

    if candidate_score <= current_score + 0.01:
        return False, "mejora_insuficiente_en_selection_score"

    return True, "modelo_guardado"


def _save_active_model(pipeline: Pipeline, metadata: dict[str, Any]) -> None:
    _ensure_artifacts_dir()
    joblib.dump(pipeline, MODEL_PATH)
    METADATA_PATH.write_text(
        json.dumps(_json_ready(metadata), indent=2, ensure_ascii=False),
        encoding="utf-8",
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
    promote_only_if_better: bool = False,
    persist_model: bool = True,
) -> dict[str, Any]:
    df, numeric_features, categorical_features = _prepare_dataframe(rows, training_variant)

    if len(df) < 30:
        raise ValueError("Se requieren al menos 30 registros para entrenar un baseline defendible")

    candidate_results: list[dict[str, Any]] = []
    best_candidate = None

    for classifier_name, classifier in _candidate_classifiers():
        result = _fit_single_candidate(
            df=df,
            numeric_features=numeric_features,
            categorical_features=categorical_features,
            classifier_name=classifier_name,
            classifier=classifier,
            project_id=project_id,
            project_name=project_name,
            source_name=source_name,
            test_size=test_size,
            random_state=random_state,
            training_variant=training_variant,
        )
        candidate_results.append(result)

        if (
            best_candidate is None
            or float(result["metadata"]["selection_score"])
            > float(best_candidate["metadata"]["selection_score"])
        ):
            best_candidate = result

    if best_candidate is None:
        raise ValueError("No fue posible entrenar candidatos válidos")

    metadata = best_candidate["metadata"]
    metadata["candidate_models"] = [
        {
            "model_name": item["metadata"]["model_type"],
            "selection_score": item["metadata"]["selection_score"],
            "metrics": item["metadata"]["metrics"],
            "cross_validation_mean": item["metadata"]["cross_validation"]["metrics_mean"],
            "brier_score": item["metadata"]["calibration_summary"]["brier_score"],
            "weak_strategy_segments": (item["metadata"].get("segment_robustness_summary", {}) or {}).get("weak_segments", {}).get("strategy", []),
        }
        for item in sorted(
            candidate_results,
            key=lambda entry: float(entry["metadata"]["selection_score"]),
            reverse=True,
        )
    ]

    current_metadata = load_baseline_metadata()

    if not persist_model:
        metadata["promoted"] = False
        metadata["promotion_reason"] = "evaluacion_sin_persistencia"
        metadata = _attach_active_model_context(
            metadata,
            current_metadata,
            promoted=False,
        )
        return _json_ready(metadata)

    if promote_only_if_better:
        promoted, reason = _can_promote_candidate(
            candidate_metadata=metadata,
            current_metadata=current_metadata,
        )
        metadata["promoted"] = promoted
        metadata["promotion_reason"] = reason
        metadata = _attach_active_model_context(
            metadata,
            current_metadata,
            promoted=promoted,
        )

        if promoted:
            _save_active_model(best_candidate["pipeline"], metadata)
    else:
        metadata["promoted"] = True
        metadata["promotion_reason"] = "modelo_guardado"
        metadata = _attach_active_model_context(
            metadata,
            current_metadata,
            promoted=True,
        )
        _save_active_model(best_candidate["pipeline"], metadata)

    return _json_ready(metadata)


def load_baseline_model() -> Pipeline | None:
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)


def load_baseline_metadata() -> dict[str, Any] | None:
    if not METADATA_PATH.exists():
        return None
    return json.loads(METADATA_PATH.read_text(encoding="utf-8"))


def get_baseline_status() -> dict[str, Any]:
    metadata = load_baseline_metadata()
    return {
        "model_exists": MODEL_PATH.exists(),
        "metadata_exists": METADATA_PATH.exists(),
        "model_path": str(MODEL_PATH),
        "metadata_path": str(METADATA_PATH),
        "metadata": metadata,
    }


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
    task_type_snapshot: str | None = None,
    snapshot_quality: str | None = None,
    historical_tasks_with_outcome: int | None = None,
    historical_success_rate: float | None = None,
    historical_avg_success_score: float | None = None,
    historical_on_time_rate: float | None = None,
    historical_quality_index: float | None = None,
    historical_no_rework_rate: float | None = None,
    same_task_type_history_count: int | None = None,
    same_task_type_success_rate: float | None = None,
    same_priority_history_count: int | None = None,
    same_priority_success_rate: float | None = None,
    recent_5_success_rate: float | None = None,
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
    model_to_use = model or load_baseline_model()
    metadata = load_baseline_metadata()

    if model_to_use is None or metadata is None:
        return None

    numeric_features = metadata.get("numeric_features", [])
    categorical_features = metadata.get("categorical_features", [])
    active_features = numeric_features + categorical_features

    feature_row = {feature: features.get(feature) for feature in active_features}
    df = pd.DataFrame([feature_row])

    probability = model_to_use.predict_proba(df)[0][1]
    return round(float(probability), 4)


def _summarize_variant_candidate(metadata: dict[str, Any], *, eligible: bool = True, reason: str | None = None) -> dict[str, Any]:
    return {
        "training_variant": metadata.get("training_variant"),
        "model_type": metadata.get("model_type"),
        "eligible": eligible,
        "reason": reason,
        "dataset_rows": metadata.get("dataset_rows"),
        "test_rows": metadata.get("test_rows"),
        "selection_score": metadata.get("selection_score"),
        "metrics": metadata.get("metrics", {}),
        "cross_validation_mean": (metadata.get("cross_validation", {}) or {}).get("metrics_mean", {}),
        "model_readiness": metadata.get("model_readiness", {}),
        "operating_threshold": metadata.get("operating_threshold"),
    }


def train_optimized_baseline_from_database(db: Session) -> dict[str, Any]:
    """
    Entrena varias variantes defendibles y promueve automáticamente la mejor.

    A diferencia del botón antiguo, que entrenaba una sola variante compacta,
    esta rutina compara compacto depurado, trusted source-aware y recalibrado
    source-aware. Así el proyecto puede mostrar una IA más seria: selección de
    campeón, validación cruzada, calibración, segmentación y umbral operativo.
    """
    from app.services.training_dataset_service import (
        build_clean_training_dataset_rows,
        build_recalibrated_training_dataset_rows,
        build_trusted_training_dataset_rows,
    )

    dataset_clean = build_clean_training_dataset_rows(db)
    dataset_trusted = build_trusted_training_dataset_rows(db)
    dataset_recalibrated = build_recalibrated_training_dataset_rows(db)

    variant_specs = [
        {
            "training_variant": "compact_cleaned_history",
            "project_name": "NeuroKanban - IA optimizada compacto depurado",
            "source_name": "historical_internal_data_cleaned",
            "rows": dataset_clean["clean_rows"],
            "dataset_summary": {
                "raw_rows": len(dataset_clean["raw_rows"]),
                "usable_rows": len(dataset_clean["clean_rows"]),
                "excluded_rows": len(dataset_clean["excluded_rows"]),
                "class_balance": dataset_clean["class_balance"],
            },
        },
        {
            "training_variant": "trusted_source_aware_history",
            "project_name": "NeuroKanban - IA optimizada trusted source-aware",
            "source_name": "historical_internal_data_trusted",
            "rows": dataset_trusted["trusted_rows"],
            "dataset_summary": {
                "raw_rows": len(dataset_trusted["raw_rows"]),
                "usable_rows": len(dataset_trusted["trusted_rows"]),
                "excluded_rows": len(dataset_trusted["excluded_rows"]),
                "class_balance": dataset_trusted["class_balance"],
            },
        },
        {
            "training_variant": "recalibrated_source_aware_history",
            "project_name": "NeuroKanban - IA optimizada recalibrado source-aware",
            "source_name": "historical_internal_data_recalibrated",
            "rows": dataset_recalibrated["recalibrated_rows"],
            "dataset_summary": {
                "raw_rows": len(dataset_recalibrated["raw_rows"]),
                "usable_rows": len(dataset_recalibrated["recalibrated_rows"]),
                "excluded_rows": len(dataset_recalibrated["excluded_rows"]),
                "repaired_snapshot_rows": dataset_recalibrated["repaired_snapshot_rows"],
                "class_balance": dataset_recalibrated["class_balance"],
            },
        },
    ]

    evaluated_variants: list[dict[str, Any]] = []
    eligible_variants: list[dict[str, Any]] = []

    for spec in variant_specs:
        rows = spec["rows"]
        if len(rows) < 30:
            evaluated_variants.append(
                {
                    "training_variant": spec["training_variant"],
                    "eligible": False,
                    "reason": "dataset_insuficiente",
                    "dataset_rows": len(rows),
                    "dataset_summary": spec["dataset_summary"],
                }
            )
            continue

        metadata = train_baseline_model_from_rows(
            rows=rows,
            project_id=None,
            project_name=spec["project_name"],
            source_name=spec["source_name"],
            training_variant=spec["training_variant"],
            promote_only_if_better=False,
            persist_model=False,
        )
        metadata["dataset_summary"] = spec["dataset_summary"]
        summary = _summarize_variant_candidate(metadata)
        summary["dataset_summary"] = spec["dataset_summary"]
        evaluated_variants.append(summary)
        eligible_variants.append({"spec": spec, "metadata": metadata})

    if not eligible_variants:
        raise ValueError("No existen datasets elegibles para entrenar la IA optimizada")

    best = max(
        eligible_variants,
        key=lambda item: float(item["metadata"].get("selection_score") or 0.0),
    )
    best_spec = best["spec"]

    final_metadata = train_baseline_model_from_rows(
        rows=best_spec["rows"],
        project_id=None,
        project_name=best_spec["project_name"],
        source_name=best_spec["source_name"],
        training_variant=best_spec["training_variant"],
        promote_only_if_better=False,
        persist_model=True,
    )

    final_metadata["optimized_variant_candidates"] = evaluated_variants
    final_metadata["optimization_summary"] = {
        "selected_variant": final_metadata.get("training_variant"),
        "selected_model_type": final_metadata.get("model_type"),
        "selected_selection_score": final_metadata.get("selection_score"),
        "evaluated_variants": len(evaluated_variants),
        "eligible_variants": len(eligible_variants),
        "selection_criteria": "mayor selection_score con métricas, calibración y robustez segmentada",
    }

    METADATA_PATH.write_text(
        json.dumps(_json_ready(final_metadata), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return _json_ready(final_metadata)


def revalidate_active_champion(db: Session) -> dict[str, Any]:
    from app.services.training_dataset_service import (
        build_clean_training_dataset_rows,
        build_recalibrated_training_dataset_rows,
        build_trusted_training_dataset_rows,
    )

    current_metadata = load_baseline_metadata()

    variants = [
        {
            "training_variant": "compact_cleaned_history",
            "project_name": "NeuroKanban - campeón revalidado compacto depurado",
            "source_name": "historical_internal_data_cleaned",
            "rows": build_clean_training_dataset_rows(db)["clean_rows"],
        },
        {
            "training_variant": "trusted_source_aware_history",
            "project_name": "NeuroKanban - campeón revalidado trusted source-aware",
            "source_name": "historical_internal_data_trusted",
            "rows": build_trusted_training_dataset_rows(db)["trusted_rows"],
        },
        {
            "training_variant": "recalibrated_source_aware_history",
            "project_name": "NeuroKanban - campeón revalidado recalibrado source-aware",
            "source_name": "historical_internal_data_recalibrated",
            "rows": build_recalibrated_training_dataset_rows(db)["recalibrated_rows"],
        },
    ]

    candidates: list[dict[str, Any]] = []
    eligible_candidates: list[dict[str, Any]] = []

    for variant in variants:
        rows = variant["rows"]
        if len(rows) < 30:
            candidates.append(
                {
                    "training_variant": variant["training_variant"],
                    "eligible": False,
                    "reason": "dataset_insuficiente",
                    "dataset_rows": len(rows),
                }
            )
            continue

        result = train_baseline_model_from_rows(
            rows=rows,
            project_id=None,
            project_name=variant["project_name"],
            source_name=variant["source_name"],
            training_variant=variant["training_variant"],
            promote_only_if_better=False,
            persist_model=False,
        )
        candidate = {
            "training_variant": variant["training_variant"],
            "eligible": True,
            "selection_score": result["selection_score"],
            "metrics": result["metrics"],
            "test_rows": result["test_rows"],
            "cross_validation": result.get("cross_validation", {}),
            "calibration_summary": result.get("calibration_summary", {}),
            "metadata": result,
            "rows": rows,
            "project_name": variant["project_name"],
            "source_name": variant["source_name"],
        }
        candidates.append(candidate)
        eligible_candidates.append(candidate)

    if not eligible_candidates:
        return {
            "revalidated": False,
            "reason": "sin_candidatos_validos",
            "current_active_variant": current_metadata.get("training_variant") if current_metadata else None,
            "candidates": candidates,
        }

    best_candidate = max(
        eligible_candidates,
        key=lambda item: float(item["selection_score"]),
    )
    best_metadata = best_candidate["metadata"]

    can_promote, reason = _can_promote_candidate(
        candidate_metadata=best_metadata,
        current_metadata=current_metadata,
    )

    if can_promote:
        persisted = train_baseline_model_from_rows(
            rows=best_candidate["rows"],
            project_id=None,
            project_name=best_candidate["project_name"],
            source_name=best_candidate["source_name"],
            training_variant=best_candidate["training_variant"],
            promote_only_if_better=False,
            persist_model=True,
        )
        return {
            "revalidated": True,
            "reason": reason,
            "current_active_variant": persisted["training_variant"],
            "champion_score": persisted["selection_score"],
            "candidates": [
                {key: value for key, value in item.items() if key not in {"metadata", "rows"}}
                for item in candidates
            ],
        }

    return {
        "revalidated": False,
        "reason": reason,
        "current_active_variant": current_metadata.get("training_variant") if current_metadata else None,
        "champion_score": current_metadata.get("selection_score") if current_metadata else None,
        "candidates": [
            {key: value for key, value in item.items() if key not in {"metadata", "rows"}}
            for item in candidates
        ],
    }
