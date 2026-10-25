import type { ApiClient } from "../client.js";

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  handler: (args: unknown, api: ApiClient) => Promise<ToolResult>;
}

export function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function err(message: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

export const STATUSES = ["a_faire", "en_cours", "termine", "bloque"] as const;
export const PRIORITIES = ["basse", "normale", "haute", "urgente"] as const;
