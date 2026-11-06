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

  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (
      init?.body
      && !(typeof FormData !== "undefined" && init.body instanceof FormData)
      && !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    response = await fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(
        "Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.",
        503,
      );
    }
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    if (response.status === 403) {
      if (data?.code === "ACCOUNT_DISABLED") {
        clearSession();
      }
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")) {
        window.location.replace("/403");
      }
    }

    throw new ApiError(data?.erreur || "Erreur serveur", response.status);
  }

  return data as T;
}
