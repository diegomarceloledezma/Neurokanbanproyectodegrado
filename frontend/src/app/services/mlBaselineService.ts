import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";

export type ModelMetricSummary = {
  accuracy: number;
  balanced_accuracy?: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
};

export type ModelCoefficient = {
  feature: string;
  coefficient: number;
  absolute_weight: number;
};

export type ClassificationReportItem = {
  precision: number;
  recall: number;
  "f1-score": number;
  support: number;
};

export type ClassificationReport = {
  "0"?: ClassificationReportItem;
  "1"?: ClassificationReportItem;
  accuracy?: number;
  "macro avg"?: ClassificationReportItem;
  "weighted avg"?: ClassificationReportItem;
};

export type ClassBalanceSummary = {
  negative_count: number;
  positive_count: number;
  minority_ratio_percent: number;
  assessment: string;
};

export type CrossValidationSummary = {
  folds: number;
  metrics_mean?: Record<string, number>;
  metrics_std?: Record<string, number>;
};

export type CalibrationBucketSummary = {
  bucket: string;
  support: number;
  mean_predicted_probability: number;
  actual_positive_rate: number;
  absolute_gap: number;
};

export type CalibrationSummary = {
  brier_score?: number | null;
  expected_calibration_error?: number | null;
  buckets?: CalibrationBucketSummary[];
};

export type ThresholdGridItem = {
  threshold: number;
  metrics: Record<string, number>;
};

export type ThresholdAnalysisSummary = {
  default_threshold: number;
  default_metrics?: Record<string, number>;
  best_f1_threshold?: number;
  best_f1_metrics?: Record<string, number>;
  best_balanced_threshold?: number;
  best_balanced_metrics?: Record<string, number>;
  grid?: ThresholdGridItem[];
};

export type SegmentPerformanceRow = {
  label: string;
  support: number;
  positive_rate: number;
  metrics: Record<string, number>;
};

export type SegmentPerformanceSummary = {
  by_strategy?: SegmentPerformanceRow[];
  by_source?: SegmentPerformanceRow[];
  by_task_type?: SegmentPerformanceRow[];
};

export type CandidateModelSummary = {
  model_name: string;
  selection_score: number;
  metrics: ModelMetricSummary;
  cross_validation_mean?: Record<string, number>;
  brier_score?: number | null;
};

export type BaselineMetadata = {
  model_type: string;
  target: string;
  project_id: number | null;
  project_name: string | null;
  training_source: string;
  training_variant: string;
  dataset_rows: number;
  train_rows: number;
  test_rows: number;
  label_distribution: Record<string, number>;
  class_balance?: ClassBalanceSummary;
  test_size: number;
  random_state: number;
  metrics: ModelMetricSummary;
  model_readiness?: {
    confidence_band: string;
    recommended_usage: string;
  };
  numeric_features: string[];
  categorical_features: string[];
  top_coefficients: ModelCoefficient[];
  classification_report?: ClassificationReport;

  selection_score?: number;
  cross_validation?: CrossValidationSummary;
  calibration_summary?: CalibrationSummary;
  threshold_analysis?: ThresholdAnalysisSummary;
  segment_performance?: SegmentPerformanceSummary;
  evaluation_notes?: string[];
  candidate_models?: CandidateModelSummary[];

  promoted?: boolean;
  promotion_reason?: string;
  current_active_selection_score?: number | null;
  candidate_selection_score?: number | null;
  current_active_model_type?: string | null;
  current_active_training_variant?: string | null;

  previous_active_selection_score?: number | null;
  previous_active_model_type?: string | null;
  previous_active_training_variant?: string | null;
  active_model_synced?: boolean;

  default_threshold_metrics?: Record<string, number>;
  operating_threshold?: number;
  thresholding_strategy?: string;
  probability_separation?: {
    positive_mean_probability?: number | null;
    negative_mean_probability?: number | null;
    separation_gap?: number | null;
    assessment?: string;
  };
  optimized_variant_candidates?: Array<{
    training_variant: string;
    model_type?: string;
    eligible: boolean;
    reason?: string | null;
    dataset_rows?: number;
    test_rows?: number;
    selection_score?: number;
    metrics?: Record<string, number>;
    cross_validation_mean?: Record<string, number>;
    operating_threshold?: number;
  }>;
  optimization_summary?: {
    selected_variant?: string;
    selected_model_type?: string;
    selected_selection_score?: number;
    evaluated_variants?: number;
    eligible_variants?: number;
    selection_criteria?: string;
  };
};

export type BaselineStatusResponse = {
  model_exists: boolean;
  metadata_exists: boolean;
  model_path: string;
  metadata_path: string;
  metadata: BaselineMetadata | null;
};

export type TrainBaselineResponse = BaselineMetadata & {
  excluded_by_reason?: Record<string, number>;
  raw_rows?: number;
  clean_rows?: number;
  trusted_rows?: number;
  base_clean_rows?: number;
  recalibrated_rows?: number;
  excluded_rows?: number;
  repaired_snapshot_rows?: number;
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

export async function getMlBaselineStatus(
  token?: string
): Promise<BaselineStatusResponse> {
  const authToken = token ?? getAccessToken();

  const response = await fetch(`${API_BASE_URL}/ml-baseline/status`, {
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo obtener el estado del modelo baseline.");
  }

  return response.json();
}

export async function trainCompactCleanedBaseline(
  token?: string
): Promise<TrainBaselineResponse> {
  const authToken = token ?? getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/ml-baseline/train-from-history-compact-cleaned`,
    {
      method: "POST",
      headers: authToken
        ? {
            Authorization: `Bearer ${authToken}`,
          }
        : undefined,
    }
  );

  if (!response.ok) {
    await parseApiError(response, "No se pudo reentrenar el modelo compacto.");
  }

  return response.json();
}

export async function trainOptimizedBaseline(
  token?: string
): Promise<TrainBaselineResponse> {
  const authToken = token ?? getAccessToken();

  const response = await fetch(`${API_BASE_URL}/ml-baseline/train-optimized`, {
    method: "POST",
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo entrenar el modelo optimizado.");
  }

  return response.json();
}