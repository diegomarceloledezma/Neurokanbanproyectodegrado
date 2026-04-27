import { API_BASE_URL } from "../config";

export type GlobalRole = {
  id: number;
  name: string;
  description?: string | null;
};

export type ProjectMemberUser = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  global_role?: GlobalRole | null;
};

export type ProjectMember = {
  id: number;
  project_id: number;
  user_id: number;
  project_role: string;
  weekly_capacity_hours?: number | null;
  availability_percentage?: number | null;
  joined_at: string;
  user: ProjectMemberUser;
};

export type ProjectResponse = {
  id: number;
  team_id: number;
  area_id?: number | null;
  name: string;
  description?: string | null;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  created_by?: number | null;
  created_at?: string;
  members?: ProjectMember[];
};

export type AvailableProjectUser = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  role_name?: string | null;
};

export type AddProjectMemberPayload = {
  user_id: number;
  project_role: string;
  weekly_capacity_hours?: number | null;
  availability_percentage?: number | null;
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  const message = data?.detail || fallback;
  throw new Error(message);
}

export async function getProjects(token: string): Promise<ProjectResponse[]> {
  const response = await fetch(`${API_BASE_URL}/projects/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudieron cargar los proyectos");
  }

  return response.json();
}

export async function getProjectById(projectId: string, token: string): Promise<ProjectResponse> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo cargar el proyecto");
  }

  return response.json();
}

export async function getProjectMembers(
  projectId: string,
  token: string
): Promise<ProjectMember[]> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudieron cargar los integrantes del proyecto");
  }

  return response.json();
}

export async function getAvailableUsersForProject(
  projectId: string,
  token: string
): Promise<AvailableProjectUser[]> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/available-users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudieron cargar los usuarios disponibles");
  }

  return response.json();
}

export async function addMemberToProject(
  projectId: string,
  payload: AddProjectMemberPayload,
  token: string
): Promise<ProjectMember> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo agregar el integrante al proyecto");
  }

  return response.json();
}

export async function removeMemberFromProject(
  projectId: string,
  memberId: number,
  token: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo quitar el integrante del proyecto");
  }

  return response.json();
}