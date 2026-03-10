import { clearSession, getAuthToken, isTokenExpired } from "@/lib/client-auth";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchWithAuth<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();

  if (!token || isTokenExpired(token)) {
    clearSession();
    throw new ApiError("Session expiree. Merci de vous reconnecter.", 401);
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }

    throw new ApiError(data?.erreur || "Erreur serveur", response.status);
  }

  return data as T;
}
