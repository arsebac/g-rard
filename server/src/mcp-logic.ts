import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AsyncLocalStorage } from "node:async_hooks";

// Use internal URL or local URL for API calls
const BASE_URL = process.env.GERARD_URL ?? "http://localhost:3000";
const API_KEY = process.env.GERARD_API_KEY;

export const mcpContextStorage = new AsyncLocalStorage<{ userId: number }>();

function apiHeaders(userId?: number, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "x-api-key": API_KEY || "" };
  if (userId) h["x-user-id"] = String(userId);
  if (extra) Object.assign(h, extra);
  return h;
}

async function handleApiError(res: Response, method: string, path: string): Promise<never> {
  let msg = `API ${method} ${path} → ${res.status}`;
  try {
    const d = await res.json();
    if (d?.error) msg += `: ${d.error}`;
  } catch {
    const t = await res.text().catch(() => "");
    if (t) msg += `: ${t}`;
  }
  throw new Error(msg);
}

async function mcpApiRequest<T>(method: string, path: string, body?: unknown, userId?: number): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: apiHeaders(userId, { "Content-Type": "application/json" }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await handleApiError(res, method, path);
  return res.json() as Promise<T>;
}

// Upload a base64-encoded file as multipart/form-data to the Gerard API
async function mcpApiUpload<T>(
  path: string,
  filename: string,
  contentBase64: string,
  mimeType: string,
  fields: Record<string, string>,
  userId?: number
): Promise<T> {
  const buffer = Buffer.from(contentBase64, "base64");
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) formData.append(k, v);
  formData.append("file", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: apiHeaders(userId),
    body: formData,
  });
  if (!res.ok) await handleApiError(res, "POST", path);
  return res.json() as Promise<T>;
}

// Fetch a binary resource and return it as a base64 string
async function mcpApiBinary(path: string, userId?: number): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: apiHeaders(userId),
  });
  if (!res.ok) await handleApiError(res, "GET", path);
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType };
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

interface DocumentSpace {
  id: number;
  name: string;
  color: string;
  description: string | null;
  parentId: number | null;
  _count?: { documents: number; children: number };
  members?: { userId: number; role: string; user: { id: number; name: string; email: string } }[];
}

interface Document {
  id: number;
  spaceId: number;
  title: string;
  description: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader?: { id: number; name: string };
}

function formatSpace(s: DocumentSpace) {
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    description: s.description,
    parentId: s.parentId,
    documentCount: s._count?.documents ?? 0,
    subfolderCount: s._count?.children ?? 0,
  };
}

function formatDocument(d: Document) {
  return {
    id: d.id,
    spaceId: d.spaceId,
    title: d.title,
    description: d.description,
    filename: d.filename,
    mimeType: d.mimeType,
    uploadedBy: d.uploader?.name ?? null,
    createdAt: d.createdAt,
    downloadUrl: `${BASE_URL}/api/documents/${d.id}/download`,
  };
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

export function createMcpServer(serverUserId?: number) {
  const server = new Server(
    { name: "gerard", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } }
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

      // ── Documents ─────────────────────────────────────────────────────────
      {
        name: "list_document_spaces",
        description: "List all document spaces accessible to the current user (top-level spaces and their subfolders)",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "create_document_space",
        description: "Create a new document space (or subfolder inside an existing space)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Space name" },
            description: { type: "string", description: "Optional description" },
            color: { type: "string", description: "Hex color (e.g. #6366f1)" },
            parentId: { type: "number", description: "Parent space ID to create a subfolder (optional)" },
          },
          required: ["name"],
        },
      },
      {
        name: "list_documents",
        description: "List documents in a space",
        inputSchema: {
          type: "object",
          properties: {
            spaceId: { type: "number", description: "Space ID" },
          },
          required: ["spaceId"],
        },
      },
      {
        name: "upload_document",
        description: "Upload a document to a space. The file content must be provided as a base64-encoded string. Tip: read the file with your Read tool and encode it with btoa() or Buffer.from(content).toString('base64').",
        inputSchema: {
          type: "object",
          properties: {
            spaceId: { type: "number", description: "Target space ID" },
            filename: { type: "string", description: "Original filename (e.g. contrat.pdf)" },
            mimeType: { type: "string", description: "MIME type (e.g. application/pdf)" },
            content_base64: { type: "string", description: "File content encoded in base64" },
            title: { type: "string", description: "Document title (defaults to filename)" },
            description: { type: "string", description: "Optional description" },
          },
          required: ["spaceId", "filename", "mimeType", "content_base64"],
        },
      },
      {
        name: "delete_document",
        description: "Delete a document from a space",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Document ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "list_space_members",
        description: "List members of a document space and their roles",
        inputSchema: {
          type: "object",
          properties: {
            spaceId: { type: "number", description: "Space ID" },
          },
          required: ["spaceId"],
        },
      },
      {
        name: "add_space_member",
        description: "Share a document space with another user",
        inputSchema: {
          type: "object",
          properties: {
            spaceId: { type: "number", description: "Space ID" },
            userId: { type: "number", description: "User ID to add" },
            role: { type: "string", enum: ["editor", "viewer"], description: "Role to grant" },
          },
          required: ["spaceId", "userId", "role"],
        },
      },
      {
        name: "remove_space_member",
        description: "Remove a user from a document space",
        inputSchema: {
          type: "object",
          properties: {
            spaceId: { type: "number", description: "Space ID" },
            userId: { type: "number", description: "User ID to remove" },
          },
          required: ["spaceId", "userId"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const userId = serverUserId ?? mcpContextStorage.getStore()?.userId;

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

        // ── Documents ──────────────────────────────────────────────────────
        case "list_document_spaces": {
          const spaces = await mcpApiRequest<DocumentSpace[]>("GET", "/api/document-spaces", undefined, userId);
          return ok(spaces.map(formatSpace));
        }

        case "create_document_space": {
          const { name, description, color, parentId } = args as any;
          const space = await mcpApiRequest<DocumentSpace>(
            "POST",
            "/api/document-spaces",
            { name, description: description ?? null, color: color ?? "#6366f1", parentId: parentId ?? null },
            userId
          );
          return ok(formatSpace(space));
        }

        case "list_documents": {
          const { spaceId } = args as any;
          const docs = await mcpApiRequest<Document[]>("GET", `/api/document-spaces/${spaceId}/documents`, undefined, userId);
          return ok(docs.map(formatDocument));
        }

        case "upload_document": {
          const { spaceId, filename, mimeType, content_base64, title, description } = args as any;
          const fields: Record<string, string> = {};
          if (title) fields["title"] = title;
          if (description) fields["description"] = description;
          const doc = await mcpApiUpload<Document>(
            `/api/document-spaces/${spaceId}/documents`,
            filename,
            content_base64,
            mimeType,
            fields,
            userId
          );
          return ok(formatDocument(doc));
        }

        case "delete_document": {
          const { id } = args as any;
          await mcpApiRequest<any>("DELETE", `/api/documents/${id}`, undefined, userId);
          return ok({ success: true });
        }

        case "list_space_members": {
          const { spaceId } = args as any;
          const members = await mcpApiRequest<any[]>("GET", `/api/document-spaces/${spaceId}/members`, undefined, userId);
          return ok(members.map((m) => ({
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
          })));
        }

        case "add_space_member": {
          const { spaceId, userId: targetUserId, role } = args as any;
          const member = await mcpApiRequest<any>(
            "POST",
            `/api/document-spaces/${spaceId}/members`,
            { userId: targetUserId, role },
            userId
          );
          return ok({ userId: member.userId, name: member.user.name, role: member.role });
        }

        case "remove_space_member": {
          const { spaceId, userId: targetUserId } = args as any;
          await mcpApiRequest<any>("DELETE", `/api/document-spaces/${spaceId}/members/${targetUserId}`, undefined, userId);
          return ok({ success: true });
        }

        default:
          return err(`Unknown tool: ${name}`);
      }
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  // ─── MCP Resources — documents as readable binary resources ───────────────

  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    const userId = mcpContextStorage.getStore()?.userId;
    try {
      const spaces = await mcpApiRequest<DocumentSpace[]>("GET", "/api/document-spaces", undefined, userId);
      const resources: { uri: string; name: string; mimeType: string; description: string }[] = [];

      for (const space of spaces) {
        const docs = await mcpApiRequest<Document[]>(
          "GET",
          `/api/document-spaces/${space.id}/documents`,
          undefined,
          userId
        );
        for (const doc of docs) {
          resources.push({
            uri: `gerard://documents/${doc.id}`,
            name: doc.title,
            mimeType: doc.mimeType,
            description: `[${space.name}] ${doc.filename} — ${new Date(doc.createdAt).toLocaleDateString()}`,
          });
        }
      }

      return { resources };
    } catch {
      return { resources: [] };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const userId = mcpContextStorage.getStore()?.userId;
    const uri = request.params.uri;
    const match = uri.match(/^gerard:\/\/documents\/(\d+)$/);
    if (!match) {
      throw new Error(`Unknown resource URI: ${uri}`);
    }

    const docId = parseInt(match[1]);
    const { base64, mimeType } = await mcpApiBinary(`/api/documents/${docId}/download`, userId);

    return {
      contents: [
        {
          uri,
          mimeType,
          blob: base64,
        },
      ],
    };
  });

  return server;
}
