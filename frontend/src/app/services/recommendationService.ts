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

export async function getTaskRecommendations(
  taskId: string,
  token: string
): Promise<TaskRecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/recommendations/tasks/${taskId}`, {
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