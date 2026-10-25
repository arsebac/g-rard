/**
 * HTTP client to call the Gerard API with API key authentication.
 */

export interface ApiClientOptions {
  baseUrl: string;
  apiKey: string | undefined;
  /** Resolves the user the API acts as; undefined sends no x-user-id header. */
  getUserId: () => number | undefined;
}

export interface ApiClient {
  baseUrl: string;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  /** Upload a base64-encoded file as multipart/form-data. */
  upload<T>(path: string, file: UploadFile, fields: Record<string, string>): Promise<T>;
  /** Fetch a binary resource and return it as a base64 string. */
  binary(path: string): Promise<{ base64: string; mimeType: string }>;
}

export interface UploadFile {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

async function throwApiError(res: Response, method: string, path: string): Promise<never> {
  let message = `API ${method} ${path} → ${res.status}`;
  // Read the body once: a failed res.json() would leave nothing for res.text().
  const text = await res.text().catch(() => "");
  try {
    const data = JSON.parse(text);
    if (data?.error) message += `: ${data.error}`;
  } catch {
    if (text) message += `: ${text}`;
  }
  throw new Error(message);
}

export function createApiClient({ baseUrl, apiKey, getUserId }: ApiClientOptions): ApiClient {
  function headers(extra?: Record<string, string>): Record<string, string> {
    if (!apiKey) {
      throw new Error("The GERARD_API_KEY environment variable is required to use the MCP server.");
    }
    const h: Record<string, string> = { "x-api-key": apiKey, ...extra };
    const userId = getUserId();
    if (userId) h["x-user-id"] = String(userId);
    return h;
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: headers({ "Content-Type": "application/json" }),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) await throwApiError(res, method, path);
    return res.json() as Promise<T>;
  }

  return {
    baseUrl,
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    patch: (path, body) => request("PATCH", path, body),
    delete: (path) => request("DELETE", path),

    async upload(path, file, fields) {
      const formData = new FormData();
      for (const [k, v] of Object.entries(fields)) formData.append(k, v);
      const buffer = Buffer.from(file.contentBase64, "base64");
      formData.append("file", new Blob([buffer], { type: file.mimeType }), file.filename);

      const res = await fetch(`${baseUrl}${path}`, { method: "POST", headers: headers(), body: formData });
      if (!res.ok) await throwApiError(res, "POST", path);
      return res.json();
    },

    async binary(path) {
      const res = await fetch(`${baseUrl}${path}`, { method: "GET", headers: headers() });
      if (!res.ok) await throwApiError(res, "GET", path);
      const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
      const buffer = Buffer.from(await res.arrayBuffer());
      return { base64: buffer.toString("base64"), mimeType };
    },
  };
}
