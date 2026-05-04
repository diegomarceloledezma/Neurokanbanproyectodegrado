import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";

export type ModelMetricSummary = {
  accuracy: number;
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
  test_size: number;
  random_state: number;
  metrics: ModelMetricSummary;
  numeric_features: string[];
  categorical_features: string[];
  top_coefficients: ModelCoefficient[];
  classification_report?: ClassificationReport;
};

export type BaselineStatusResponse = {
  model_exists: boolean;
  metadata_exists: boolean;
  model_path: string;
  metadata_path: string;
  metadata: BaselineMetadata | null;
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