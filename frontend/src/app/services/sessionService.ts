export type StoredUser = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  role_name?: string | null;
};

const ACCESS_TOKEN_KEY = "nk_access_token";
const USER_KEY = "nk_user";

export function saveSession(accessToken: string, user: StoredUser) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    clearSession();
    return null;
  }
}

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  const payload = parseJwt(token);
  if (!payload || typeof payload.exp !== "number") return true;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds;
}

export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) return false;

  if (isTokenExpired(token)) {
    clearSession();
    return false;
  }

  return true;
}

export function requireValidSession(): { token: string; user: StoredUser } | null {
  const token = getAccessToken();
  const user = getStoredUser();

  if (!token || !user) {
    clearSession();
    return null;
  }

  if (isTokenExpired(token)) {
    clearSession();
    return null;
  }

  return { token, user };
}