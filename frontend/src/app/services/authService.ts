import { API_BASE_URL } from "../config";
import { clearSession, saveSession, type StoredUser } from "./sessionService";

export type LoginPayload = {
  username_or_email: string;
  password: string;
};

export type RegisterPayload = {
  full_name: string;
  username: string;
  email: string;
  password: string;
  avatar_url?: string | null;
  global_role_id?: number | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: StoredUser;
};

function normalizeApiErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "string") return first;
    if (
      typeof first === "object" &&
      first !== null &&
      "msg" in first &&
      typeof (first as { msg?: unknown }).msg === "string"
    ) {
      return (first as { msg: string }).msg;
    }
  }

  return fallback;
}

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  const message = normalizeApiErrorMessage((data as { detail?: unknown } | null)?.detail, fallback);
  throw new Error(message);
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo iniciar sesión");
  }

  const data = (await response.json()) as LoginResponse;
  saveSession(data.access_token, data.user);
  return data;
}

export async function register(payload: RegisterPayload): Promise<StoredUser> {
  const response = await fetch(`${API_BASE_URL}/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo registrar el usuario");
  }

  return response.json();
}

export async function fetchCurrentUser(token: string): Promise<StoredUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    clearSession();
    await parseApiError(response, "Tu sesión expiró o ya no es válida");
  }

  return response.json();
}

export function logout() {
  clearSession();
}