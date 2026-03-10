export interface AuthUser {
  id: number;
  nom: string;
  email: string;
  role: string;
}

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) {
      return null;
    }

    const decoded = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getTokenExpirationDate(token: string): Date | null {
  const payload = decodePayload(token);
  const exp = payload?.exp;

  if (typeof exp !== "number") {
    return null;
  }

  return new Date(exp * 1000);
}

export function isTokenExpired(token: string): boolean {
  const expiration = getTokenExpirationDate(token);
  if (!expiration) {
    return true;
  }

  return Date.now() >= expiration.getTime();
}

export function getSecondsUntilExpiration(token: string): number {
  const expiration = getTokenExpirationDate(token);
  if (!expiration) {
    return 0;
  }

  return Math.max(0, Math.floor((expiration.getTime() - Date.now()) / 1000));
}

export function formatRemainingSession(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) {
    return `${h}h ${m}m`;
  }

  return `${m}m`;
}
