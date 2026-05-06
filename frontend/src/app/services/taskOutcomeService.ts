import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";

export type TaskOutcomeResponse = {
  id: number;
  task_id: number;
  completed_at: string | null;
  finished_on_time: boolean | null;
  delay_hours: number;
  quality_score: number | null;
  had_rework: boolean;
  rework_count: number;
  success_score: number;
  notes: string | null;
};

export type TaskOutcomeCreate = {
  completed_at?: string | null;
  finished_on_time?: boolean | null;
  delay_hours?: number;
  quality_score?: number | null;
  had_rework?: boolean;
  rework_count?: number | null;
  notes?: string | null;
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

export async function getTaskOutcome(
  taskId: string | number,
  token?: string
): Promise<TaskOutcomeResponse | null> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/outcome`, {
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo obtener el resultado de la tarea.");
  }

  return response.json();
}

export async function upsertTaskOutcome(
  taskId: string | number,
  payload: TaskOutcomeCreate,
  token?: string
): Promise<TaskOutcomeResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/outcome`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo guardar el resultado de la tarea.");
  }

  return response.json();
}