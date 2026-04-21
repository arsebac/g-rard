import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "./db";
import { AsyncLocalStorage } from "node:async_hooks";

// Note: On utilise directement fetch ou l'API interne ici pour éviter les imports croisés
const BASE_URL = process.env.GERARD_URL ?? "http://localhost:3000";
const API_KEY = process.env.GERARD_API_KEY;

export const mcpContextStorage = new AsyncLocalStorage<{ userId: number }>();

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

// ─── Types (from mcp/src/index.ts) ──────────────────────────────────────────

interface Project {
  id: number;
  name: string;
  key: string | null;
  description: string | null;
  color: string;
  _count?: { tasks: number };
}

interface Task {
  id: number;
  projectId: number;
  number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: number | null;
  dueDate: string | null;
  projectKey?: string | null;
  assignee?: { id: number; name: string } | null;
  labels?: { label: { name: string; color: string } }[];
  comments?: any[];
}

// ... other types omitted for brevity, but I'll use them in the handlers

function formatTask(t: Task) {
  return {
    id: t.id,
    ref: t.projectKey ? `${t.projectKey}-${t.number}` : null,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee?.name ?? null,
    dueDate: t.dueDate,
    labels: t.labels?.map((l) => l.label.name) ?? [],
  };
}

export function createMcpServer() {
  const server = new Server(
    { name: "gerard", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
      {
        name: "list_tasks",
        description: "Liste les tâches d'un projet, avec filtres optionnels",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "number", description: "ID du projet" },
            status: {
              type: "string",
              enum: ["a_faire", "en_cours", "termine", "bloque"],
              description: "Filtrer par statut",
            },
            assigneeId: { type: "number", description: "Filtrer par assignée (user ID)" },
          },
          required: ["projectId"],
        },
      },
      {
        name: "search_tasks",
        description: "Recherche fulltext dans les tâches (titre et description)",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Termes de recherche (min 2 caractères)" },
            projectId: { type: "number", description: "Restreindre à un projet (optionnel)" },
          },
          required: ["q"],
        },
      },
      {
        name: "get_task",
        description: "Récupère le détail d'une tâche par son ID ou sa référence (ex: CUI-4)",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "ID numérique de la tâche" },
            ref: { type: "string", description: "Référence style CUI-4 (alternative à id)" },
          },
        },
      },
      {
        name: "create_task",
        description: "Crée une nouvelle tâche dans un projet",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "number", description: "ID du projet" },
            title: { type: "string", description: "Titre de la tâche" },
            description: { type: "string", description: "Description" },
            status: { type: "string", enum: ["a_faire", "en_cours", "termine", "bloque"], default: "a_faire" },
            priority: { type: "string", enum: ["basse", "normale", "haute", "urgente"], default: "normale" },
            assigneeId: { type: "number" },
            dueDate: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["projectId", "title"],
        },
      },
      {
        name: "update_task",
        description: "Modifie une tâche existante",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["a_faire", "en_cours", "termine", "bloque"] },
            priority: { type: "string", enum: ["basse", "normale", "haute", "urgente"] },
            assigneeId: { type: ["number", "null"] },
            dueDate: { type: ["string", "null"] },
          },
          required: ["id"],
        },
      },
      {
        name: "list_wiki_pages",
        description: "Liste les pages wiki d'un projet",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "number", description: "ID du projet (optionnel)" },
          },
        },
      },
      {
        name: "get_wiki_page",
        description: "Récupère le contenu d'une page wiki",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number" },
          },
          required: ["id"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const userId = mcpContextStorage.getStore()?.userId;

    try {
      switch (name) {
        case "get_auth_url":
          return ok({ 
            authUrl: `${BASE_URL}/mcp-auth`,
            instructions: "Récupérez votre token sur cette page et utilisez-le dans l'URL du serveur MCP."
          });
          
        case "list_projects": {
          const projects = await mcpApiRequest<Project[]>("GET", "/api/projects", undefined, userId);
          return ok(projects.map((p) => ({
            id: p.id,
            name: p.name,
            key: p.key,
            description: p.description,
            taskCount: p._count?.tasks ?? 0,
          })));
        }

        case "list_tasks": {
          const { projectId, status, assigneeId } = args as any;
          const params = new URLSearchParams();
          if (status) params.set("status", status);
          if (assigneeId) params.set("assigneeId", String(assigneeId));
          const qs = params.toString();
          const tasks = await mcpApiRequest<Task[]>("GET", `/api/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`, undefined, userId);
          return ok(tasks.map(formatTask));
        }

        case "search_tasks": {
          const { q, projectId } = args as any;
          const params = new URLSearchParams({ q });
          if (projectId !== undefined) params.set("projectId", String(projectId));
          const results = await mcpApiRequest<any[]>("GET", `/api/search?${params.toString()}`, undefined, userId);
          return ok(results);
        }

        case "get_task": {
          const { id, ref } = args as any;
          if (ref) {
            const match = ref.match(/^([A-Z]+)-(\d+)$/i);
            if (!match) return err("Format de référence invalide (ex: CUI-4)");
            const task = await mcpApiRequest<Task>("GET", `/api/tasks/ref/${match[1]}/${match[2]}`, undefined, userId);
            return ok(formatTask(task));
          }
          const task = await mcpApiRequest<Task>("GET", `/api/tasks/${id}`, undefined, userId);
          return ok(formatTask(task));
        }

        case "create_task": {
          const { projectId, ...body } = args as any;
          const task = await mcpApiRequest<Task>("POST", `/api/projects/${projectId}/tasks`, body, userId);
          return ok(formatTask(task));
        }

        case "update_task": {
          const { id, ...body } = args as any;
          const task = await mcpApiRequest<Task>("PATCH", `/api/tasks/${id}`, body, userId);
          return ok(formatTask(task));
        }

        case "list_wiki_pages": {
          const { projectId } = args as any;
          const pages = await mcpApiRequest<any[]>("GET", projectId ? `/api/projects/${projectId}/wiki` : "/api/wiki", undefined, userId);
          return ok(pages.map(p => ({ id: p.id, title: p.title, slug: p.slug })));
        }

        case "get_wiki_page": {
          const { id } = args as any;
          const page = await mcpApiRequest<any>("GET", `/api/wiki/pages/${id}`, undefined, userId);
          return ok(page);
        }

        default:
          return err(`Outil inconnu : ${name}`);
      }
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  return server;
}
