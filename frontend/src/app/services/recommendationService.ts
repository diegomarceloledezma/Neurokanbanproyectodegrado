import { API_BASE_URL } from "../config";

export type RecommendationMode = "heuristic" | "hybrid";

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
  risk_level: "low" | "medium" | "high";
  active_tasks: number;
  matching_skills: string[];
  workload_score: number;
  skill_match_score: number;
  availability_score: number;
  performance_score: number;
  heuristic_score: number | null;
  ml_success_probability: number | null;
  hybrid_score: number | null;
  model_used: boolean;
};

export type TaskRecommendationResponse = {
  task_id: number;
  task_title: string;
  strategy: string;
  mode: RecommendationMode;
  recommendations: TaskRecommendationItem[];
};

export type TaskSimulationItem = {
  rank: number;
  member: RecommendationMember;
  score: number;
  risk_level: "low" | "medium" | "high";
  reason: string;
  current_load: number;
  projected_load: number;
  current_availability: number;
  projected_availability: number;
  current_active_tasks: number;
  projected_active_tasks: number;
  estimated_hours_impact: number;
  matching_skills: string[];
  heuristic_score: number | null;
  ml_success_probability: number | null;
  hybrid_score: number | null;
  model_used: boolean;
};

export type TaskSimulationResponse = {
  task_id: number;
  task_title: string;
  strategy: string;
  mode: RecommendationMode;
  simulations: TaskSimulationItem[];
};

export type TaskInsightResponse = {
  task_id: number;
  task_title: string;
  suggested_strategy: "balance" | "efficiency" | "urgency" | "learning";
  suggested_strategy_label: string;
  suggested_area: string;
  suggested_skills: string[];
  confidence_level: "alta" | "media" | "baja";
  detected_signals: string[];
  explanation: string;
};

function buildRecommendationUrl(
  taskId: string,
  strategy: string,
  mode: RecommendationMode,
  simulation = false
) {
  const suffix = simulation ? "/simulation" : "";
  const params = new URLSearchParams({
    strategy,
    mode,
  });

  return `${API_BASE_URL}/recommendations/tasks/${taskId}${suffix}?${params.toString()}`;
}

export async function getTaskRecommendations(
  taskId: string,
  token: string,
  strategy = "balance",
  mode: RecommendationMode = "heuristic"
): Promise<TaskRecommendationResponse> {
  const response = await fetch(buildRecommendationUrl(taskId, strategy, mode), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudieron obtener las recomendaciones");
  }

  return response.json();
}

export async function getTaskSimulation(
  taskId: string,
  token: string,
  strategy = "balance",
  mode: RecommendationMode = "heuristic"
): Promise<TaskSimulationResponse> {
  const response = await fetch(buildRecommendationUrl(taskId, strategy, mode, true), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo obtener la simulación");
  }

  return response.json();
}

export async function getTaskInsights(
  taskId: string,
  token: string
): Promise<TaskInsightResponse> {
  const response = await fetch(`${API_BASE_URL}/recommendations/tasks/${taskId}/insights`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo obtener el análisis inteligente");
  }

  return response.json();
}
