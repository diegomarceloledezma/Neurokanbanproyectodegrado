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

let authFetchInterceptorInstalled = false;
let redirectingToLogin = false;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);

  if (!payload) {
    return true;
  }

  const exp = payload.exp;
  if (typeof exp !== "number") {
    return true;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowInSeconds + skewSeconds;
}

function getRawAccessToken(): string | null {
  if (!isBrowser()) return null;

  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export function getAccessToken(): string | null {
  const token = getRawAccessToken();

  if (!token) return null;

  if (isTokenExpired(token)) {
    clearSession();
    return null;
  }

  return token;
}

export function setAccessToken(token: string): void {
  if (!isBrowser()) return;
  localStorage.setItem("access_token", token);
}

export function getCurrentUser(): StoredUser | null {
  if (!isBrowser()) return null;

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
  if (!isBrowser()) return;
  localStorage.setItem("auth_user", JSON.stringify(user));
}

export function saveSession(token: string, user: StoredUser): void {
  setAccessToken(token);
  setCurrentUser(user);
}

export function clearSession(): void {
  if (!isBrowser()) return;

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

export function buildLoginRedirectUrl(reason: "expired" | "invalid" = "expired"): string {
  if (!isBrowser()) return "/login";

  const currentPath = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams();
  params.set("session", reason);

  if (currentPath && !currentPath.startsWith("/login")) {
    params.set("from", currentPath);
  }

  return `/login?${params.toString()}`;
}

export function redirectToLogin(reason: "expired" | "invalid" = "expired"): void {
  if (!isBrowser() || redirectingToLogin) return;

  redirectingToLogin = true;
  clearSession();
  window.location.assign(buildLoginRedirectUrl(reason));
}

function headersContainAuthorization(headers?: HeadersInit): boolean {
  if (!headers) return false;

  if (headers instanceof Headers) {
    return headers.has("Authorization") || headers.has("authorization");
  }

  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === "authorization");
  }

  return Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
}

function requestHasAuthorization(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (headersContainAuthorization(init?.headers)) return true;

  if (typeof Request !== "undefined" && input instanceof Request) {
    return headersContainAuthorization(input.headers);
  }

  return false;
}

function isAuthEndpoint(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  return url.includes("/auth/login") || url.includes("/users/register");
}

export function installAuthFetchInterceptor(): void {
  if (!isBrowser() || authFetchInterceptorInstalled) return;

  authFetchInterceptorInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);

    const hasAuthorization = requestHasAuthorization(input, init);
    const shouldRedirect =
      hasAuthorization &&
      !isAuthEndpoint(input) &&
      (response.status === 401 || response.status === 403);

    if (shouldRedirect) {
      redirectToLogin(response.status === 401 ? "expired" : "invalid");
    }

    return response;
  };
}