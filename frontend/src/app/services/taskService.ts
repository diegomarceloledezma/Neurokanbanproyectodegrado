import { API_BASE_URL } from "../config";

export type TaskRequiredSkillResponse = {
  id: number;
  skill_id: number;
  required_level: number;
  skill?: {
    id: number;
    name: string;
    category?: string | null;
    description?: string | null;
    area?: {
      id: number;
      name: string;
      description?: string | null;
    } | null;
  } | null;
};

export type TaskResponse = {
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
  created_at: string;
  updated_at: string;
  required_skills: TaskRequiredSkillResponse[];
  assignee?: {
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

export type TaskRequiredSkillCreate = {
  skill_id: number;
  required_level: number;
};

export type TaskCreatePayload = {
  project_id: number;
  title: string;
  description?: string;
  task_type: string;
  priority: string;
  complexity: number;
  status?: string;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  created_by?: number;
  assigned_to?: number | null;
  required_skills?: TaskRequiredSkillCreate[];
};

export type TaskAssignPayload = {
  assigned_to: number;
  assigned_by?: number;
  source?: "manual" | "recommended" | "simulated" | "hybrid";
  strategy?: string;
  recommendation_score?: number;
  risk_level?: string;
  reason?: string;
  recommendation_used?: boolean;
};

export type AssignmentHistoryResponse = {
  id: number;
  task_id: number;
  assigned_to: number;
  assigned_by?: number | null;
  source: "manual" | "recommended" | "simulated" | "hybrid";
  strategy?: string | null;
  recommendation_score?: number | null;
  risk_level?: string | null;
  reason?: string | null;
  recommendation_used: boolean;
  created_at: string;
  task: {
    id: number;
    project_id: number;
    title: string;
    priority: string;
    status: string;
    complexity: number;
    estimated_hours?: number | null;
    actual_hours?: number | null;
    due_date?: string | null;
  };
  assigned_user: {
    id: number;
    full_name: string;
    email: string;
    global_role?: {
      id: number;
      name: string;
      description?: string | null;
    } | null;
  };
  assigned_by_user?: {
    id: number;
    full_name: string;
    email: string;
    global_role?: {
      id: number;
      name: string;
      description?: string | null;
    } | null;
  } | null;
};

export async function getTasksByProject(projectId: string, token: string): Promise<TaskResponse[]> {
  const response = await fetch(`${API_BASE_URL}/tasks/project/${projectId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudieron obtener las tareas del proyecto");
  }

  return response.json();
}

export async function getTaskById(taskId: string, token: string): Promise<TaskResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo obtener la tarea");
  }

  return response.json();
}

export async function createTask(payload: TaskCreatePayload, token: string): Promise<TaskResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo crear la tarea");
  }

  return response.json();
}

export async function assignTask(
  taskId: string,
  payload: TaskAssignPayload,
  token: string
): Promise<TaskResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/assign`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo asignar la tarea");
  }

  return response.json();
}

export async function getAssignmentHistory(
  token: string,
  projectId?: string
): Promise<AssignmentHistoryResponse[]> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const response = await fetch(`${API_BASE_URL}/tasks/assignment-history${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo obtener el historial de decisiones");
  }

  return response.json();
}