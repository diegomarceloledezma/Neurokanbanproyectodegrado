import { API_BASE_URL } from "../config";

export type DecisionHistoryItem = {
  id: number;
  task_id: number;
  task_title: string;
  project_id: number;
  task_status: string;
  assigned_user_id: number;
  assigned_user_name: string;
  assigned_user_role: string;
  source: string;
  strategy?: string | null;
  recommendation_score: number;
  risk_level?: string | null;
  reason?: string | null;
  recommendation_used?: boolean | null;
  created_at: string;
};

export type DecisionHistoryResponse = {
  total_records: number;
  items: DecisionHistoryItem[];
};

export type DecisionHistoryFilters = {
  project_id?: number;
  source?: string;
  strategy?: string;
  limit?: number;
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

export async function getDecisionHistory(
  token: string,
  filters: DecisionHistoryFilters = {}
): Promise<DecisionHistoryResponse> {
  const params = new URLSearchParams();

  if (filters.project_id) params.set("project_id", String(filters.project_id));
  if (filters.source) params.set("source", filters.source);
  if (filters.strategy) params.set("strategy", filters.strategy);
  if (filters.limit) params.set("limit", String(filters.limit));

  const query = params.toString();
  const url = `${API_BASE_URL}/decision-history/${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo cargar el historial de decisiones");
  }

  return response.json();
}