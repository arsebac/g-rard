/**
 * Gerard MCP Server — control your home project manager from Claude Code.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { api } from "./client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: number;
  name: string;
  key: string | null;
  description: string | null;
  color: string;
  status: string;
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
  comments?: Comment[];
}

interface WikiPage {
  id: number;
  projectId: number | null;
  parentId: number | null;
  title: string;
  slug: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Comment {
  id: number;
  taskId: number;
  body: string;
  createdAt: string;
  author: { id: number; name: string };
}

interface ActivityLog {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: { id: number; name: string };
}

interface Sprint {
  id: number;
  projectId: number;
  name: string;
  goal: string | null;
  status: "futur" | "actif" | "termine";
  startDate: string | null;
  endDate: string | null;
  _count?: { tasks: number };
}

interface Label {
  id: number;
  projectId: number;
  name: string;
  color: string;
}

interface RecurringTask {
  id: number;
  projectId: number;
  title: string;
  recurrenceType: "EVERY_N_WEEKS" | "MONTHLY_BEFORE_END" | "CUSTOM_DATES";
  intervalWeeks: number | null;
  daysBeforeEndOfMonth: number | null;
  customDates: string[] | null;
  priority: string;
  _count?: { tasks: number };
}

interface Attachment {
  id: number;
  entityType: string;
  entityId: number;
  filename: string;
  mimeType: string;
  createdAt: string;
  uploader: { id: number; name: string };
}

interface DocumentSpace {
  id: number;
  name: string;
  color: string;
  description: string | null;
  parentId: number | null;
  position: number;
  createdAt: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Server ───────────────────────────────────────────────────────────────────

export const server = new Server(
  { name: "gerard", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_auth_url",
      description: "Retrieve the authentication URL to link your Gérard account to the MCP server",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_projects",
      description: "List all active projects in Gérard",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_tasks",
      description: "List tasks for a project, with optional filters",
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
          description: { type: "string", description: "Description (free text or Tiptap JSON)" },
          status: {
            type: "string",
            enum: ["a_faire", "en_cours", "termine", "bloque"],
            default: "a_faire",
          },
          priority: {
            type: "string",
            enum: ["basse", "normale", "haute", "urgente"],
            default: "normale",
          },
          assigneeId: { type: "number", description: "ID of the assigned user" },
          dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
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
          dueDate: { type: ["string", "null"], description: "YYYY-MM-DD or null to clear" },
        },
        required: ["id"],
      },
    },
    {
      name: "move_task",
      description: "Move a task to another kanban column",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "Task ID" },
          status: {
            type: "string",
            enum: ["a_faire", "en_cours", "termine", "bloque"],
            description: "New column",
          },
        },
        required: ["id", "status"],
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
      description: "Retrieve wiki page content by ID",
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
      name: "list_sprints",
      description: "List sprints for a project",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "Project ID" },
        },
        required: ["projectId"],
      },
    },
    {
      name: "create_sprint",
      description: "Create a new sprint",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "Project ID" },
          name: { type: "string", description: "Sprint name" },
          goal: { type: "string", description: "Sprint goal" },
          startDate: { type: "string", description: "YYYY-MM-DD" },
          endDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["projectId", "name"],
      },
    },
    {
      name: "update_sprint",
      description: "Modify an existing sprint",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "Sprint ID" },
          name: { type: "string" },
          goal: { type: "string" },
          status: { type: "string", enum: ["futur", "actif", "termine"] },
          startDate: { type: "string" },
          endDate: { type: "string" },
        },
        required: ["id"],
      },
    },
    {
      name: "list_comments",
      description: "List comments for a task",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "Task ID" },
        },
        required: ["taskId"],
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
    {
      name: "list_users",
      description: "List Gérard users (for assignment)",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_labels",
      description: "List available labels for a project",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "Project ID" },
        },
        required: ["projectId"],
      },
    },
    {
      name: "create_label",
      description: "Create a new label in a project",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "Project ID" },
          name: { type: "string", description: "Label name" },
          color: { type: "string", description: "Hex color (e.g., #FF0000)" },
        },
        required: ["projectId", "name", "color"],
      },
    },
    {
      name: "add_label_to_task",
      description: "Assign a label to a task",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "Task ID" },
          labelId: { type: "number", description: "Label ID" },
        },
        required: ["taskId", "labelId"],
      },
    },
    {
      name: "remove_label_from_task",
      description: "Remove a label from a task",
      inputSchema: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "Task ID" },
          labelId: { type: "number", description: "Label ID" },
        },
        required: ["taskId", "labelId"],
      },
    },
    {
      name: "list_attachments",
      description: "List attachments for a task, project, or wiki page",
      inputSchema: {
        type: "object",
        properties: {
          entityType: { type: "string", enum: ["task", "project", "wiki_page"] },
          entityId: { type: "number", description: "Entity ID" },
        },
        required: ["entityType", "entityId"],
      },
    },
    {
      name: "get_activity",
      description: "Retrieve activity history for a task or project",
      inputSchema: {
        type: "object",
        properties: {
          entityType: { type: "string", enum: ["task", "project"] },
          entityId: { type: "number" },
          limit: { type: "number", default: 20 },
        },
        required: ["entityType", "entityId"],
      },
    },
    // ── Recurring tasks ───────────────────────────────────────────────────────
    {
      name: "list_recurring_tasks",
      description: "List recurring task templates for a project",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "Project ID" },
        },
        required: ["projectId"],
      },
    },
    {
      name: "create_recurring_task",
      description: "Create a recurring task template and generate occurrences",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "Project ID" },
          title: { type: "string", description: "Recurring task title" },
          recurrenceType: {
            type: "string",
            enum: ["EVERY_N_WEEKS", "MONTHLY_BEFORE_END", "CUSTOM_DATES"],
            description: "Recurrence type",
          },
          intervalWeeks: { type: "number", description: "Interval in weeks (for EVERY_N_WEEKS)" },
          daysBeforeEndOfMonth: { type: "number", description: "Days before end of month (for MONTHLY_BEFORE_END)" },
          customDates: {
            type: "array",
            items: { type: "string" },
            description: "Specific dates in YYYY-MM-DD format (for CUSTOM_DATES)",
          },
          priority: { type: "string", enum: ["basse", "normale", "haute", "urgente"] },
          assigneeId: { type: "number", description: "ID of the assigned user" },
          description: { type: "string" },
        },
        required: ["projectId", "title", "recurrenceType"],
      },
    },
    {
      name: "update_recurring_task",
      description: "Modify a recurring task template and regenerate future occurrences",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "Template ID" },
          title: { type: "string" },
          recurrenceType: { type: "string", enum: ["EVERY_N_WEEKS", "MONTHLY_BEFORE_END", "CUSTOM_DATES"] },
          intervalWeeks: { type: "number" },
          daysBeforeEndOfMonth: { type: "number" },
          customDates: { type: "array", items: { type: "string" } },
          priority: { type: "string", enum: ["basse", "normale", "haute", "urgente"] },
          assigneeId: { type: ["number", "null"] },
        },
        required: ["id"],
      },
    },
    {
      name: "regenerate_recurring_task",
      description: "Regenerate future occurrences of a recurring task. Use after receiving a schedule (e.g., trash collection schedule) to replace future dates with provided ones.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "Recurring template ID" },
          customDates: {
            type: "array",
            items: { type: "string" },
            description: "New dates in YYYY-MM-DD format. Mandatory for CUSTOM_DATES type.",
          },
        },
        required: ["id"],
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_auth_url": {
        const baseUrl = process.env.GERARD_URL ?? "http://localhost:3000";
        return ok({
          message: "To authenticate the MCP server, please log in to Gérard in your browser and retrieve your MCP token.",
          authUrl: `${baseUrl}/mcp-auth`,
          instructions: "Once logged in, copy the token and configure your MCP client to use the URL: " + `${baseUrl}/mcp?token=YOUR_TOKEN`
        });
      }
      // ── Projects ──────────────────────────────────────────────────────────
      case "list_projects": {
        const projects = await api.get<Project[]>("/api/projects");
        return ok(projects.map((p) => ({
          id: p.id,
          name: p.name,
          key: p.key,
          description: p.description,
          color: p.color,
          taskCount: p._count?.tasks ?? 0,
        })));
      }

      // ── Tasks ─────────────────────────────────────────────────────────────
      case "list_tasks": {
        const { projectId, status, assigneeId } = z
          .object({
            projectId: z.number(),
            status: z.string().optional(),
            assigneeId: z.number().optional(),
          })
          .parse(args);

        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (assigneeId) params.set("assigneeId", String(assigneeId));
        const qs = params.toString();

        const tasks = await api.get<Task[]>(
          `/api/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`
        );
        return ok(tasks.map(formatTask));
      }

      case "search_tasks": {
        const { q, projectId } = z
          .object({ q: z.string().min(2), projectId: z.number().optional() })
          .parse(args);

        const params = new URLSearchParams({ q });
        if (projectId !== undefined) params.set("projectId", String(projectId));

        const results = await api.get<unknown[]>(`/api/search?${params}`);
        return ok(results);
      }

      case "get_task": {
        const { id, ref } = z
          .object({ id: z.number().optional(), ref: z.string().optional() })
          .parse(args);

        if (ref) {
          const match = ref.match(/^([A-Z]+)-(\d+)$/i);
          if (!match) return err("Invalid reference format (e.g., CUI-4)");
          const task = await api.get<Task>(`/api/tasks/ref/${match[1]}/${match[2]}`);
          return ok(formatTask(task));
        }

        if (id !== undefined) {
          const task = await api.get<Task>(`/api/tasks/${id}`);
          return ok(formatTask(task));
        }

        return err("Provide id or ref");
      }

      case "create_task": {
        const data = z
          .object({
            projectId: z.number(),
            title: z.string().min(1),
            description: z.string().optional(),
            status: z.enum(["a_faire", "en_cours", "termine", "bloque"]).default("a_faire"),
            priority: z.enum(["basse", "normale", "haute", "urgente"]).default("normale"),
            assigneeId: z.number().optional(),
            dueDate: z.string().optional(),
          })
          .parse(args);

        const { projectId, ...body } = data;
        const task = await api.post<Task>(`/api/projects/${projectId}/tasks`, body);
        return ok(formatTask(task));
      }

      case "update_task": {
        const { id, ...body } = z
          .object({
            id: z.number(),
            title: z.string().optional(),
            description: z.string().optional(),
            status: z.enum(["a_faire", "en_cours", "termine", "bloque"]).optional(),
            priority: z.enum(["basse", "normale", "haute", "urgente"]).optional(),
            assigneeId: z.number().nullable().optional(),
            dueDate: z.string().nullable().optional(),
          })
          .parse(args);

        const task = await api.patch<Task>(`/api/tasks/${id}`, body);
        return ok(formatTask(task));
      }

      case "move_task": {
        const { id, status } = z
          .object({
            id: z.number(),
            status: z.enum(["a_faire", "en_cours", "termine", "bloque"]),
          })
          .parse(args);

        const task = await api.patch<Task>(`/api/tasks/${id}/move`, { status, position: 0 });
        return ok(formatTask(task));
      }

      // ── Wiki ──────────────────────────────────────────────────────────────
      case "list_wiki_pages": {
        const { projectId } = z
          .object({ projectId: z.number().optional() })
          .parse(args ?? {});

        const pages = await api.get<WikiPage[]>(
          projectId !== undefined
            ? `/api/projects/${projectId}/wiki`
            : "/api/wiki"
        );
        return ok(
          pages.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            parentId: p.parentId,
            updatedAt: p.updatedAt,
          }))
        );
      }

      case "get_wiki_page": {
        const { id } = z.object({ id: z.number() }).parse(args);
        const page = await api.get<WikiPage>(`/api/wiki/pages/${id}`);
        return ok(page);
      }

      case "create_wiki_page": {
        const data = z
          .object({
            projectId: z.number().optional(),
            parentId: z.number().optional(),
            title: z.string().min(1),
            body: z.string(),
          })
          .parse(args);

        const page = await api.post<WikiPage>("/api/wiki/pages", data);
        return ok({ id: page.id, title: page.title, slug: page.slug });
      }

      case "update_wiki_page": {
        const { id, ...body } = z
          .object({
            id: z.number(),
            title: z.string().optional(),
            body: z.string().optional(),
          })
          .parse(args);

        const page = await api.patch<WikiPage>(`/api/wiki/pages/${id}`, body);
        return ok({ id: page.id, title: page.title, slug: page.slug });
      }

      case "delete_wiki_page": {
        const { id } = z.object({ id: z.number() }).parse(args);
        await api.delete(`/api/wiki/pages/${id}`);
        return ok({ success: true });
      }

      // ── Sprints ───────────────────────────────────────────────────────────
      case "list_sprints": {
        const { projectId } = z.object({ projectId: z.number() }).parse(args);
        const sprints = await api.get<Sprint[]>(`/api/projects/${projectId}/sprints`);
        return ok(
          sprints.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            goal: s.goal,
            taskCount: s._count?.tasks ?? 0,
          }))
        );
      }

      case "create_sprint": {
        const { projectId, ...body } = z
          .object({
            projectId: z.number(),
            name: z.string().min(1),
            goal: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
          })
          .parse(args);

        const sprint = await api.post<Sprint>(`/api/projects/${projectId}/sprints`, body);
        return ok(sprint);
      }

      case "update_sprint": {
        const { id, ...body } = z
          .object({
            id: z.number(),
            name: z.string().optional(),
            goal: z.string().optional(),
            status: z.enum(["futur", "actif", "termine"]).optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
          })
          .parse(args);

        const sprint = await api.patch<Sprint>(`/api/sprints/${id}`, body);
        return ok(sprint);
      }

      // ── Comments ──────────────────────────────────────────────────────────
      case "list_comments": {
        const { taskId } = z.object({ taskId: z.number() }).parse(args);
        const comments = await api.get<Comment[]>(`/api/tasks/${taskId}/comments`);
        return ok(
          comments.map((c) => ({
            id: c.id,
            author: c.author.name,
            body: c.body,
            createdAt: c.createdAt,
          }))
        );
      }

      case "add_comment": {
        const { taskId, body } = z
          .object({ taskId: z.number(), body: z.string().min(1) })
          .parse(args);

        const comment = await api.post<Comment>(`/api/tasks/${taskId}/comments`, { body });
        return ok({ id: comment.id, author: comment.author.name, createdAt: comment.createdAt });
      }

      // ── Users ─────────────────────────────────────────────────────────────
      case "list_users": {
        const users = await api.get<User[]>("/api/users");
        return ok(
          users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          }))
        );
      }

      // ── Labels ────────────────────────────────────────────────────────────
      case "list_labels": {
        const { projectId } = z.object({ projectId: z.number() }).parse(args);
        const labels = await api.get<Label[]>(`/api/projects/${projectId}/labels`);
        return ok(labels);
      }

      case "create_label": {
        const { projectId, ...body } = z
          .object({
            projectId: z.number(),
            name: z.string().min(1),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          })
          .parse(args);

        const label = await api.post<Label>(`/api/projects/${projectId}/labels`, body);
        return ok(label);
      }

      case "add_label_to_task": {
        const { taskId, labelId } = z
          .object({ taskId: z.number(), labelId: z.number() })
          .parse(args);

        await api.post(`/api/tasks/${taskId}/labels/${labelId}`, {});
        return ok({ success: true });
      }

      case "remove_label_from_task": {
        const { taskId, labelId } = z
          .object({ taskId: z.number(), labelId: z.number() })
          .parse(args);

        await api.delete(`/api/tasks/${taskId}/labels/${labelId}`);
        return ok({ success: true });
      }

      // ── Attachments ───────────────────────────────────────────────────────
      case "list_attachments": {
        const { entityType, entityId } = z
          .object({
            entityType: z.enum(["task", "project", "wiki_page"]),
            entityId: z.number(),
          })
          .parse(args);

        const attachments = await api.get<Attachment[]>(
          `/api/attachments?entityType=${entityType}&entityId=${entityId}`
        );
        return ok(
          attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            mimeType: a.mimeType,
            uploadedBy: a.uploader.name,
            createdAt: a.createdAt,
            downloadUrl: `/api/attachments/${a.id}/download`,
          }))
        );
      }

      // ── Activity ──────────────────────────────────────────────────────────
      case "get_activity": {
        const { entityType, entityId, limit } = z
          .object({
            entityType: z.enum(["task", "project"]),
            entityId: z.number(),
            limit: z.number().default(20),
          })
          .parse(args);

        const path =
          entityType === "task"
            ? `/api/tasks/${entityId}/activity`
            : `/api/projects/${entityId}/activity`;

        const logs = await api.get<ActivityLog[]>(`${path}?limit=${limit}`);
        return ok(
          logs.map((l) => ({
            id: l.id,
            action: l.action,
            actor: l.actor.name,
            oldValue: l.oldValue ? JSON.parse(l.oldValue) : null,
            newValue: l.newValue ? JSON.parse(l.newValue) : null,
            createdAt: l.createdAt,
          }))
        );
      }

      // ── Recurring tasks ───────────────────────────────────────────────────
      case "list_recurring_tasks": {
        const { projectId } = z.object({ projectId: z.number() }).parse(args);
        const templates = await api.get<RecurringTask[]>(`/api/projects/${projectId}/recurring-tasks`);
        return ok(templates.map((r) => ({
          id: r.id,
          title: r.title,
          recurrenceType: r.recurrenceType,
          intervalWeeks: r.intervalWeeks,
          daysBeforeEndOfMonth: r.daysBeforeEndOfMonth,
          customDates: r.customDates,
          priority: r.priority,
          taskCount: r._count?.tasks ?? 0,
        })));
      }

      case "create_recurring_task": {
        const { projectId, ...body } = z
          .object({
            projectId: z.number(),
            title: z.string().min(1),
            recurrenceType: z.enum(["EVERY_N_WEEKS", "MONTHLY_BEFORE_END", "CUSTOM_DATES"]),
            intervalWeeks: z.number().optional(),
            daysBeforeEndOfMonth: z.number().optional(),
            customDates: z.array(z.string()).optional(),
            priority: z.enum(["basse", "normale", "haute", "urgente"]).optional(),
            assigneeId: z.number().optional(),
            description: z.string().optional(),
          })
          .parse(args);
        const template = await api.post<RecurringTask>(`/api/projects/${projectId}/recurring-tasks`, body);
        return ok({ id: template.id, title: template.title, recurrenceType: template.recurrenceType, taskCount: template._count?.tasks ?? 0 });
      }

      case "update_recurring_task": {
        const { id, ...body } = z
          .object({
            id: z.number(),
            title: z.string().optional(),
            recurrenceType: z.enum(["EVERY_N_WEEKS", "MONTHLY_BEFORE_END", "CUSTOM_DATES"]).optional(),
            intervalWeeks: z.number().optional(),
            daysBeforeEndOfMonth: z.number().optional(),
            customDates: z.array(z.string()).optional(),
            priority: z.enum(["basse", "normale", "haute", "urgente"]).optional(),
            assigneeId: z.number().nullable().optional(),
          })
          .parse(args);
        const template = await api.patch<RecurringTask>(`/api/recurring-tasks/${id}`, body);
        return ok({ id: template.id, title: template.title, recurrenceType: template.recurrenceType, taskCount: template._count?.tasks ?? 0 });
      }

      case "regenerate_recurring_task": {
        const { id, customDates } = z
          .object({ id: z.number(), customDates: z.array(z.string()).optional() })
          .parse(args);
        const template = await api.post<RecurringTask>(`/api/recurring-tasks/${id}/regenerate`, { customDates });
        return ok({ id: template.id, title: template.title, taskCount: template._count?.tasks ?? 0 });
      }

      default:
        return err(`Outil inconnu : ${name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});

// ─── Task formatter ───────────────────────────────────────────────────────────

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
    comments: t.comments?.map((c) => ({
      author: c.author.name,
      body: c.body,
      createdAt: c.createdAt,
    })) ?? [],
  };
}
