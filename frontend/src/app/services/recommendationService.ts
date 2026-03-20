import { API_BASE_URL } from "../config";

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
};

export type TaskRecommendationResponse = {
  task_id: number;
  task_title: string;
  strategy: string;
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
};

export type TaskSimulationResponse = {
  task_id: number;
  task_title: string;
  strategy: string;
  simulations: TaskSimulationItem[];
};

export async function getTaskRecommendations(
  taskId: string,
  token: string,
  strategy = "balance"
): Promise<TaskRecommendationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/recommendations/tasks/${taskId}?strategy=${encodeURIComponent(strategy)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudieron obtener las recomendaciones");
  }

  return response.json();
}

export async function getTaskSimulation(
  taskId: string,
  token: string,
  strategy = "balance"
): Promise<TaskSimulationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/recommendations/tasks/${taskId}/simulation?strategy=${encodeURIComponent(
      strategy
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo obtener la simulación");
  }

  return response.json();
}