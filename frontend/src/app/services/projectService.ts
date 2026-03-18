import { API_BASE_URL } from "../config";

export type ProjectResponse = {
  id: number;
  team_id: number;
  name: string;
  description?: string | null;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  area?: {
    id: number;
    name: string;
    description?: string | null;
  } | null;
  creator?: {
    id: number;
    full_name: string;
    username: string;
    email: string;
    avatar_url?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    global_role?: {
      id: number;
      name: string;
      description?: string | null;
    } | null;
  } | null;
};

export async function getProjects(token: string): Promise<ProjectResponse[]> {
  const response = await fetch(`${API_BASE_URL}/projects/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudieron obtener los proyectos");
  }

  return response.json();
}

export async function getProjectById(projectId: string, token: string): Promise<ProjectResponse> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo obtener el proyecto");
  }

  return response.json();
}