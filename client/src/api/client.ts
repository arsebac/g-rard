async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(!isFormData && options?.body != null ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Erreur réseau" }));
    throw new Error(error.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  baseURL: "", // empty string = relative URLs

  get: <T>(url: string) => request<T>(url),

  post: <T>(url: string, data?: unknown) => {
    const isFormData = data instanceof FormData;
    return request<T>(url, {
      method: "POST",
      body: isFormData ? (data as any) : JSON.stringify(data),
      headers: isFormData ? {} : undefined, // let the browser set boundary for FormData
    });
  },

  patch: <T>(url: string, data?: unknown) => {
    const isFormData = data instanceof FormData;
    return request<T>(url, {
      method: "PATCH",
      body: isFormData ? (data as any) : JSON.stringify(data),
      headers: isFormData ? {} : undefined,
    });
  },

  put: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(data) }),

  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
