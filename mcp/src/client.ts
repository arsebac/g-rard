/**
 * Client HTTP pour appeler l'API Gérard avec authentification par API key.
 */

const BASE_URL = process.env.GERARD_URL ?? "http://localhost:3000";
const API_KEY = process.env.GERARD_API_KEY;

if (!API_KEY) {
  console.error("Erreur : La variable d'environnement GERARD_API_KEY est requise.");
  process.exit(1);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY as string,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errorMessage = `API ${method} ${path} → ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData && errorData.error) {
        errorMessage += `: ${errorData.error}`;
      }
    } catch {
      const text = await res.text().catch(() => "");
      if (text) errorMessage += `: ${text}`;
    }
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
