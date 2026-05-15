import { API_BASE_URL } from "../config";

export type TaskResourceUploaderSummary = {
  id: number;
  full_name: string;
  email: string;
};

export type TaskResourceResponse = {
  id: number;
  task_id: number;
  original_filename: string;
  stored_filename: string;
  content_type?: string | null;
  size_bytes: number;
  note?: string | null;
  file_url: string;
  uploaded_by: number;
  created_at: string;
  uploaded_by_user?: TaskResourceUploaderSummary | null;
};

function resolveFileUrl(value: string) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

function normalizeResource(resource: TaskResourceResponse): TaskResourceResponse {
  return {
    ...resource,
    file_url: resolveFileUrl(resource.file_url),
  };
}

export async function getTaskResources(taskId: string, token: string): Promise<TaskResourceResponse[]> {
  const response = await fetch(`${API_BASE_URL}/task-resources/tasks/${taskId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudieron obtener los recursos de la tarea");
  }

  const data = (await response.json()) as TaskResourceResponse[];
  return data.map(normalizeResource);
}

export async function uploadTaskResource(
  taskId: string,
  file: File,
  note: string,
  token: string
): Promise<TaskResourceResponse> {
  const formData = new FormData();
  formData.append("file", file);

  if (note.trim()) {
    formData.append("note", note.trim());
  }

  const response = await fetch(`${API_BASE_URL}/task-resources/tasks/${taskId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo subir el recurso");
  }

  const data = (await response.json()) as TaskResourceResponse;
  return normalizeResource(data);
}

export async function deleteTaskResource(
  resourceId: number,
  token: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/task-resources/${resourceId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo eliminar el recurso");
  }

  return response.json();
}