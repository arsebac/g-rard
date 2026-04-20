import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "./db";

// Note: On utilise directement fetch ou l'API interne ici pour éviter les imports croisés
const BASE_URL = process.env.GERARD_URL ?? "http://localhost:3000";
const API_KEY = process.env.GERARD_API_KEY;

async function mcpApiRequest<T>(method: string, path: string, body?: unknown, userId?: number): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY || "",
  };
  if (userId) headers["x-user-id"] = String(userId);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export const mcpServer = new Server(
  { name: "gerard", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string) {
  return {
    content: [{ type: "text" as const, text: `Erreur : ${message}` }],
    isError: true,
  };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_auth_url",
      description: "Récupère l'URL d'authentification pour lier votre compte Gérard au serveur MCP",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_projects",
      description: "Liste tous les projets actifs dans Gérard",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    // ... (je raccourcis ici pour le test, on remettra tout après confirmation)
    {
      name: "list_tasks",
      description: "Liste les tâches d'un projet",
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "number" } },
        required: ["projectId"],
      },
    },
  ],
}));

// Mock minimal de contextStorage pour le test
import { AsyncLocalStorage } from "node:async_hooks";
export const mcpContextStorage = new AsyncLocalStorage<{ userId: number }>();

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const userId = mcpContextStorage.getStore()?.userId;

  try {
    switch (name) {
      case "get_auth_url":
        return ok({ authUrl: `${BASE_URL}/mcp-auth` });
      case "list_projects":
        const projects = await mcpApiRequest("/api/projects", "GET", undefined, userId);
        return ok(projects);
      default:
        return err(`Outil inconnu : ${name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});
