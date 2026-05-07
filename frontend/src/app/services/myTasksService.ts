import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";

export type MyTaskSkillItem = {
  id: number;
  required_level: number;
  skill?: {
    id: number;
    name: string;
  } | null;
};

export type MyTaskUserItem = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  role_name?: string | null;
  global_role?: {
    id?: number;
    name?: string;
    description?: string;
  } | null;
};

export type MyTaskItem = {
  id: number;
  project_id: number;
  title: string;
  description?: string | null;
  task_type: string;
  priority: string;
  complexity: number;
  status: string;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  due_date?: string | null;
  created_by: number;
  assigned_to?: number | null;
  creator?: MyTaskUserItem | null;
  assignee?: MyTaskUserItem | null;
  required_skills?: MyTaskSkillItem[];
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

export async function getMyTasks(token?: string): Promise<MyTaskItem[]> {
  const authToken = token ?? getAccessToken();

  const response = await fetch(`${API_BASE_URL}/tasks/my`, {
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudieron cargar tus tareas.");
  }

  return response.json();
}