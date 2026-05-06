import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";

export type RecommendationMember = {
  id: number;
  full_name: string;
  email: string;
  role_name: string;
};

export type TaskRecommendationItem = {
  member: RecommendationMember;
  score: number;
  reason: string;
  availability: string;
  current_load: string;
  risk_level: string;
  active_tasks: number;
  matching_skills: string[];
  workload_score: number;
  skill_match_score: number;
  availability_score: number;
  performance_score: number;
  heuristic_score?: number | null;
  ml_success_probability?: number | null;
  hybrid_score?: number | null;
  model_used: boolean;
};

export type TaskRecommendationResponse = {
  task_id: number;
  task_title: string;
  strategy: string;
  mode: string;
  recommendations: TaskRecommendationItem[];
};

export type TaskSimulationItem = {
  rank: number;
  member: RecommendationMember;
  score: number;
  risk_level: string;
  reason: string;
  current_load: number;
  projected_load: number;
  current_availability: number;
  projected_availability: number;
  current_active_tasks: number;
  projected_active_tasks: number;
  estimated_hours_impact: number;
  matching_skills: string[];
  heuristic_score?: number | null;
  ml_success_probability?: number | null;
  hybrid_score?: number | null;
  model_used: boolean;
};

export type TaskSimulationResponse = {
  task_id: number;
  task_title: string;
  strategy: string;
  mode: string;
  simulations: TaskSimulationItem[];
};

export type TaskInsightResponse = {
  task_id: number;
  task_title: string;
  suggested_strategy: string;
  suggested_strategy_label: string;
  suggested_area: string;
  suggested_skills: string[];
  confidence_level: string;
  detected_signals: string[];
  explanation: string;
};

export type TaskAssignRequest = {
  assigned_to: number;
  assigned_by?: number | null;
  source: string;
  strategy?: string | null;
  recommendation_score?: number | null;
  risk_level?: string | null;
  reason?: string | null;
  recommendation_used?: boolean;
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
        "Content-Type": "application/json",
      }
    : {
        "Content-Type": "application/json",
      };
}

export async function getTaskRecommendationsIntelligence(
  taskId: string | number,
  strategy: string,
  mode: string,
  token?: string
): Promise<TaskRecommendationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/recommendations/tasks/${taskId}?strategy=${strategy}&mode=${mode}`,
    {
      headers: buildHeaders(token),
    }
  );

  if (!response.ok) {
    await parseApiError(response, "No se pudieron obtener las recomendaciones.");
  }

  return response.json();
}

export async function getTaskSimulationIntelligence(
  taskId: string | number,
  strategy: string,
  mode: string,
  token?: string
): Promise<TaskSimulationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/recommendations/tasks/${taskId}/simulation?strategy=${strategy}&mode=${mode}`,
    {
      headers: buildHeaders(token),
    }
  );

  if (!response.ok) {
    await parseApiError(response, "No se pudo obtener la simulación.");
  }

  return response.json();
}

export async function getTaskInsightsIntelligence(
  taskId: string | number,
  token?: string
): Promise<TaskInsightResponse> {
  const response = await fetch(`${API_BASE_URL}/recommendations/tasks/${taskId}/insights`, {
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudieron obtener los insights.");
  }

  return response.json();
}

export async function assignTaskFromRecommendation(
  taskId: string | number,
  payload: TaskAssignRequest,
  token?: string
) {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/assign`, {
    method: "PATCH",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo asignar la tarea.");
  }

  return response.json();
}