export type StoredUser = {
  id?: number;
  full_name?: string;
  username?: string;
  email?: string;
  role_name?: string;
  global_role?: {
    id?: number;
    name?: string;
    description?: string;
  };
};

const TOKEN_KEYS = [
  "access_token",
  "token",
] as const;

const USER_KEYS = [
  "auth_user",
  "user",
  "neurokanban_user",
  "current_user",
] as const;

export function getAccessToken(): string | null {
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export function setAccessToken(token: string): void {
  localStorage.setItem("access_token", token);
}

export function getCurrentUser(): StoredUser | null {
  for (const key of USER_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      continue;
    }
  }

  return null;
}

export function getStoredUser(): StoredUser | null {
  return getCurrentUser();
}

export function setCurrentUser(user: StoredUser): void {
  localStorage.setItem("auth_user", JSON.stringify(user));
}

export function saveSession(token: string, user: StoredUser): void {
  setAccessToken(token);
  setCurrentUser(user);
}

export function clearSession(): void {
  for (const key of TOKEN_KEYS) {
    localStorage.removeItem(key);
  }

  for (const key of USER_KEYS) {
    localStorage.removeItem(key);
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}