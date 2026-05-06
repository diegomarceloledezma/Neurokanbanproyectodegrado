import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";

export type AssignmentEffectivenessBreakdownItem = {
  label: string;
  count: number;
  average_success_score: number | null;
  average_quality_score: number | null;
  on_time_rate: number;
  rework_rate: number;
};

export type AssignmentEffectivenessSummaryResponse = {
  project_id: number | null;
  total_records_with_outcome: number;
  ai_records_with_outcome: number;
  non_ai_records_with_outcome: number;
  average_success_score_overall: number | null;
  average_success_score_ai: number | null;
  average_success_score_non_ai: number | null;
  average_quality_score_overall: number | null;
  overall_on_time_rate: number;
  overall_rework_rate: number;
  ai_on_time_rate: number;
  non_ai_on_time_rate: number;
  ai_vs_non_ai_gap: number | null;
  source_breakdown: AssignmentEffectivenessBreakdownItem[];
  strategy_breakdown: AssignmentEffectivenessBreakdownItem[];
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

export async function getAssignmentEffectivenessSummary(
  token?: string
): Promise<AssignmentEffectivenessSummaryResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/assignment-effectiveness-summary`, {
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo obtener el resumen de efectividad de asignación.");
  }

  return response.json();
}