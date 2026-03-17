import { API_BASE_URL } from "../config";

export type LoginPayload = {
  username_or_email: string;
  password: string;
};

export type UserResponse = {
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
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: UserResponse;
};

export type RegisterPayload = {
  full_name: string;
  username: string;
  email: string;
  password: string;
  avatar_url?: string | null;
  global_role_id: number;
};

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al iniciar sesión");
  }

  return response.json();
}

export async function registerUser(payload: RegisterPayload) {
  const response = await fetch(`${API_BASE_URL}/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al registrarse");
  }

  return response.json();
}

export async function getCurrentUser(token: string): Promise<UserResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo obtener el usuario autenticado");
  }

  return response.json();
}