import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";

export type CleanTrainingPreviewRow = {
  assignment_decision_id: number;
  task_id: number;
  project_id: number;
  assigned_to: number;
  source: string;
  strategy: string;
  recommendation_used: boolean;
  recommendation_score: number;
  workload_score: number;
  skill_match_score: number;
  availability_score: number;
  performance_score: number;
  current_load_snapshot: number;
  availability_snapshot: number;
  active_tasks_snapshot: number;
  required_skills_count: number;
  matching_skills_count: number;
  matching_ratio: number;
  estimated_hours_snapshot: number;
  priority_snapshot: string;
  complexity_snapshot: number;
  finished_on_time: boolean | null;
  delay_hours: number;
  quality_score: number;
  had_rework: boolean;
  success_score: number;
  success_label: number;
};

export type ExcludedTrainingRow = {
  assignment_decision_id: number;
  task_id: number;
  reasons: string[];
};

export type CleanTrainingPreviewResponse = {
  raw_total_rows: number;
  clean_total_rows: number;
  excluded_rows: number;
  excluded_by_reason: Record<string, number>;
  label_distribution: Record<string, number>;
  source_distribution: Record<string, number>;
  strategy_distribution: Record<string, number>;
  sample_rows: CleanTrainingPreviewRow[];
  sample_excluded_rows: ExcludedTrainingRow[];
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

export async function getCleanTrainingPreview(
  limit = 20,
  token?: string
): Promise<CleanTrainingPreviewResponse> {
  const authToken = token ?? getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/training-data/preview-cleaned?limit=${limit}`,
    {
      headers: authToken
        ? {
            Authorization: `Bearer ${authToken}`,
          }
        : undefined,
    }
  );

  if (!response.ok) {
    await parseApiError(response, "No se pudo obtener el preview del dataset limpio.");
  }

  return response.json();
}