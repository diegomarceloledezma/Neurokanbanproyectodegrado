import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";
import type { TaskResponse } from "./taskService";

export type TaskStatusUpdatePayload = {
  status: "pending" | "in_progress" | "review" | "blocked" | "done";
  actual_hours?: number | null;
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

function buildHeaders(token?: string) {
  const authToken = token ?? getAccessToken();

  return authToken
    ? {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      }
    : {
        "Content-Type": "application/json",
      };
}

export async function updateTaskStatus(
  taskId: string | number,
  payload: TaskStatusUpdatePayload,
  token?: string
): Promise<TaskResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo actualizar el estado de la tarea.");
  }

  return response.json();
}