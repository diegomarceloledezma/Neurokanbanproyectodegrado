import { API_BASE_URL } from "../config";

export type DashboardProjectItem = {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  members_count: number;
};

export type DashboardRecommendationItem = {
  id: number;
  task_id: number;
  task_title: string;
  assigned_user_name: string;
  recommendation_score: number;
  strategy?: string | null;
  source: string;
  created_at: string;
};

export type DashboardOverviewResponse = {
  total_projects: number;
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  team_load_average: number;
  average_completion_rate: number;
  recent_projects: DashboardProjectItem[];
  recent_recommendations: DashboardRecommendationItem[];
};

export type DashboardValuePoint = {
  id: number;
  name: string;
  primary_value: number;
  secondary_value?: number | null;
};

export type DashboardStatusDistributionItem = {
  id: string;
  name: string;
  value: number;
};

export type DashboardTeamMemberMetricItem = {
  id: number;
  name: string;
  role_name: string;
  active_tasks: number;
  current_load: number;
  completion_rate: number;
};

export type DashboardTeamMetricsResponse = {
  completed_tasks: number;
  delayed_tasks: number;
  average_completion_rate: number;
  total_tasks: number;
  tasks_by_status: DashboardStatusDistributionItem[];
  workload_data: DashboardValuePoint[];
  performance_data: DashboardValuePoint[];
  time_comparison_data: DashboardValuePoint[];
  team_members: DashboardTeamMemberMetricItem[];
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

export async function getDashboardOverview(token: string): Promise<DashboardOverviewResponse> {
  const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo cargar el resumen del dashboard");
  }

  return response.json();
}

export async function getDashboardTeamMetrics(token: string): Promise<DashboardTeamMetricsResponse> {
  const response = await fetch(`${API_BASE_URL}/dashboard/team-metrics`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudieron cargar las métricas del equipo");
  }

  return response.json();
}