import { API_BASE_URL } from "../config";

export type RecommendationMode = "heuristic" | "hybrid";
export type DecisionStatus =
  | "assignable_candidate_found"
  | "no_assignable_candidate";

export type RecommendedAction =
  | "assign_now"
  | "assign_with_mentoring_and_supervision"
  | "replan_or_escalate"
  | "replan_or_explicit_risk_acceptance";

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

export type CandidateBucketItem = {
  member: RecommendationMember;
  score: number;
  reason: string;
  assignability_status: "assignable" | "risky" | "not_assignable";
  assignability_label: string;
  operation_state: "feasible" | "stressed" | "critical";
  risk_level: "low" | "medium" | "high";
  availability: number;
  current_load: number;
  active_tasks: number;
  matching_skills: string[];
  heuristic_score: number | null;
  ml_success_probability: number | null;
  hybrid_score: number | null;
  model_used: boolean;
};

export type AssignabilitySummary = {
  assignable_count: number;
  risky_count: number;
  not_assignable_count: number;
};

export type TaskRecommendationResponse = {
  task_id: number;
  task_title: string;
  strategy: string;
  mode: RecommendationMode;
  recommendations: TaskRecommendationItem[];
  decision_status: DecisionStatus;
  recommended_action: RecommendedAction;
  primary_candidate_available: boolean;
  primary_candidate: CandidateBucketItem | null;
  assignability_summary: AssignabilitySummary;
  assignable_candidates: CandidateBucketItem[];
  risky_candidates: CandidateBucketItem[];
  not_assignable_candidates: CandidateBucketItem[];
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
  decision_status: DecisionStatus;
  recommended_action: RecommendedAction;
  primary_candidate_available: boolean;
  primary_candidate: CandidateBucketItem | null;
  assignability_summary: AssignabilitySummary;
  assignable_candidates: CandidateBucketItem[];
  risky_candidates: CandidateBucketItem[];
  not_assignable_candidates: CandidateBucketItem[];
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

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const errorData = await response.json().catch(() => null);
  throw new Error(errorData?.detail || fallback);
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
    await parseApiError(response, "No se pudieron obtener las recomendaciones");
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
    await parseApiError(response, "No se pudo obtener la simulación");
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
    await parseApiError(response, "No se pudo obtener el análisis inteligente");
  }

  return response.json();
}