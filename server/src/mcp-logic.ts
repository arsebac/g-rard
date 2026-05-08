import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AsyncLocalStorage } from "node:async_hooks";

// Use internal URL or local URL for API calls
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
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

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
        description: "Get the authentication URL to link your Gérard account to the MCP server",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "list_projects",
        description: "List all active projects in Gérard",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "list_tasks",
        description: "List tasks for a project with optional filters",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "number", description: "Project ID" },
            status: {
              type: "string",
              enum: ["a_faire", "en_cours", "termine", "bloque"],
              description: "Filter by status",
            },
            assigneeId: { type: "number", description: "Filter by assignee (user ID)" },
          },
          required: ["projectId"],
        },
      },
      {
        name: "search_tasks",
        description: "Fulltext search in tasks (title and description)",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search terms (min 2 characters)" },
            projectId: { type: "number", description: "Restrict to a project (optional)" },
          },
          required: ["q"],
        },
      },
      {
        name: "get_task",
        description: "Retrieve task details by ID or reference (e.g., CUI-4)",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Numeric task ID" },
            ref: { type: "string", description: "Reference like CUI-4 (alternative to id)" },
          },
        },
      },
      {
        name: "create_task",
        description: "Create a new task in a project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "number", description: "Project ID" },
            title: { type: "string", description: "Task title" },
            description: { type: "string", description: "Task description" },
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
        description: "Modify an existing task",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Task ID" },
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
        description: "List wiki pages for a project (or global wiki if no projectId)",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "number", description: "Project ID (optional)" },
          },
        },
      },
      {
        name: "get_wiki_page",
        description: "Retrieve a wiki page content by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Wiki page ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "create_wiki_page",
        description: "Create a new wiki page",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "number", description: "Project ID (null = global wiki)" },
            parentId: { type: "number", description: "Parent page ID (optional)" },
            title: { type: "string", description: "Page title" },
            body: { type: "string", description: "Markdown content" },
          },
          required: ["title", "body"],
        },
      },
      {
        name: "update_wiki_page",
        description: "Modify an existing wiki page",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Wiki page ID" },
            title: { type: "string", description: "New title" },
            body: { type: "string", description: "New content" },
          },
          required: ["id"],
        },
      },
      {
        name: "delete_wiki_page",
        description: "Delete a wiki page",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Wiki page ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "add_comment",
        description: "Add a comment to a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "number", description: "Task ID" },
            body: { type: "string", description: "Comment body" },
          },
          required: ["taskId", "body"],
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
            instructions: "Get your token on this page and use it in your MCP client configuration (e.g., as a query param ?token=... or header x-mcp-token)."
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
            if (!match) return err("Invalid reference format (e.g., CUI-4)");
            const task = await mcpApiRequest<Task>("GET", `/api/tasks/ref/${match[1]}/${match[2]}`, undefined, userId);
            return ok(formatTask(task));
          }
          if (id === undefined) return err("Provide id or ref");
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
          const path = projectId ? `/api/projects/${projectId}/wiki` : "/api/wiki";
          const pages = await mcpApiRequest<any[]>("GET", path, undefined, userId);
          return ok(pages.map(p => ({ id: p.id, title: p.title, slug: p.slug })));
        }

        case "get_wiki_page": {
          const { id } = args as any;
          const page = await mcpApiRequest<any>("GET", `/api/wiki/pages/${id}`, undefined, userId);
          return ok(page);
        }

        case "create_wiki_page": {
          const { projectId, ...body } = args as any;
          const page = await mcpApiRequest<any>("POST", "/api/wiki/pages", body, userId);
          return ok({ id: page.id, title: page.title, slug: page.slug });
        }

        case "update_wiki_page": {
          const { id, ...body } = args as any;
          const page = await mcpApiRequest<any>("PATCH", `/api/wiki/pages/${id}`, body, userId);
          return ok({ id: page.id, title: page.title, slug: page.slug });
        }

        case "delete_wiki_page": {
          const { id } = args as any;
          await mcpApiRequest<any>("DELETE", `/api/wiki/pages/${id}`, undefined, userId);
          return ok({ success: true });
        }

        case "add_comment": {
          const { taskId, body } = args as any;
          const comment = await mcpApiRequest<any>("POST", `/api/tasks/${taskId}/comments`, { body }, userId);
          return ok(comment);
        }

        default:
          return err(`Unknown tool: ${name}`);
      }
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  return server;
}
