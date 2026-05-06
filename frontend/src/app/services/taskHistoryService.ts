import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";

export type TaskAssignmentHistoryItem = {
  id: number;
  task_id: number;
  assigned_to: number;
  assigned_by?: number | null;
  source: string;
  strategy?: string | null;
  recommendation_score?: number | null;
  risk_level?: string | null;
  reason?: string | null;
  recommendation_used: boolean;
  workload_score?: number | null;
  skill_match_score?: number | null;
  availability_score?: number | null;
  performance_score?: number | null;
  current_load_snapshot?: number | null;
  availability_snapshot?: number | null;
  active_tasks_snapshot?: number | null;
  required_skills_count?: number | null;
  matching_skills_count?: number | null;
  matching_ratio?: number | null;
  estimated_hours_snapshot?: number | null;
  priority_snapshot?: string | null;
  complexity_snapshot?: number | null;
  created_at: string;
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

function buildHeaders(token?: string) {
  const authToken = token ?? getAccessToken();

  return authToken
    ? {
        Authorization: `Bearer ${authToken}`,
      }
    : undefined;
}

export async function getTaskAssignmentHistory(
  taskId: string | number,
  token?: string
): Promise<TaskAssignmentHistoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/assignment-history`, {
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo obtener el historial de asignación.");
  }

  return response.json();
}