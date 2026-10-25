import { z } from "zod";
import type { Task } from "../types.js";
import type { Tool } from "./types.js";
import { err, ok, PRIORITIES, STATUSES } from "./types.js";

export function formatTask(t: Task) {
  return {
    id: t.id,
    ref: t.projectKey ? `${t.projectKey}-${t.number}` : null,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee?.name ?? null,
    dueDate: t.dueDate,
    type: t.type ? { id: t.type.id, name: t.type.name, isEpic: t.type.isEpic } : null,
    parent: t.parent
      ? {
          id: t.parent.id,
          ref: t.parent.project?.key ? `${t.parent.project.key}-${t.parent.number}` : null,
          title: t.parent.title,
        }
      : null,
    labels: t.labels?.map((l) => l.label.name) ?? [],
    archived: t.archived ?? false,
    // Only the single-task endpoints return comments.
    ...(t.comments && {
      comments: t.comments.map((c) => ({ author: c.author.name, body: c.body, createdAt: c.createdAt })),
    }),
  };
}

export const taskTools: Tool[] = [
  {
    name: "list_tasks",
    description: "List tasks for a project with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "Project ID" },
        status: { type: "string", enum: STATUSES, description: "Filter by status" },
        assigneeId: { type: "number", description: "Filter by assignee (user ID)" },
        parentId: { type: "number", description: "Filter by parent/epic task ID (list an epic's sub-tasks)" },
        includeArchived: { type: "boolean", description: "Also return done tasks archived off the board (default false)" },
      },
      required: ["projectId"],
    },
    handler: async (args, api) => {
      const { projectId, status, assigneeId, parentId, includeArchived } = z
        .object({
          projectId: z.number(),
          status: z.string().optional(),
          assigneeId: z.number().optional(),
          parentId: z.number().optional(),
          includeArchived: z.boolean().optional(),
        })
        .parse(args);

      const params = new URLSearchParams();
      if (!includeArchived) params.set("archived", "exclude");
      if (status) params.set("status", status);
      if (assigneeId) params.set("assigneeId", String(assigneeId));
      if (parentId) params.set("parentId", String(parentId));
      const qs = params.toString();

      const tasks = await api.get<Task[]>(`/api/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`);
      return ok(tasks.map(formatTask));
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
    handler: async (args, api) => {
      const { q, projectId } = z.object({ q: z.string().min(2), projectId: z.number().optional() }).parse(args);
      const params = new URLSearchParams({ q });
      if (projectId !== undefined) params.set("projectId", String(projectId));
      return ok(await api.get<unknown[]>(`/api/search?${params}`));
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
    handler: async (args, api) => {
      const { id, ref } = z.object({ id: z.number().optional(), ref: z.string().optional() }).parse(args ?? {});
      if (ref) {
        const match = ref.match(/^([A-Z]+)-(\d+)$/i);
        if (!match) return err("Invalid reference format (e.g., CUI-4)");
        return ok(formatTask(await api.get<Task>(`/api/tasks/ref/${match[1]}/${match[2]}`)));
      }
      if (id === undefined) return err("Provide id or ref");
      return ok(formatTask(await api.get<Task>(`/api/tasks/${id}`)));
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
        description: { type: "string", description: "Task description, in Markdown (GFM). Ticket refs like DEV-12 become links." },
        status: { type: "string", enum: STATUSES, default: "a_faire" },
        priority: { type: "string", enum: PRIORITIES, default: "normale" },
        assigneeId: { type: "number" },
        dueDate: { type: "string", description: "YYYY-MM-DD" },
        typeId: { type: "number", description: "Ticket type ID (e.g. Epic, Story, Task, Bug — see list_tasks/get_task output or project ticket types)" },
        parentId: { type: "number", description: "Parent/epic task ID — links this task under an epic" },
      },
      required: ["projectId", "title"],
    },
    handler: async (args, api) => {
      const { projectId, ...body } = z
        .object({
          projectId: z.number(),
          title: z.string().min(1),
          description: z.string().optional(),
          status: z.enum(STATUSES).default("a_faire"),
          priority: z.enum(PRIORITIES).default("normale"),
          assigneeId: z.number().optional(),
          dueDate: z.string().optional(),
          typeId: z.number().optional(),
          parentId: z.number().optional(),
        })
        .parse(args);
      return ok(formatTask(await api.post<Task>(`/api/projects/${projectId}/tasks`, body)));
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
        description: { type: "string", description: "Task description, in Markdown (GFM). Replaces the whole description." },
        status: { type: "string", enum: STATUSES },
        priority: { type: "string", enum: PRIORITIES },
        assigneeId: { type: ["number", "null"] },
        dueDate: { type: ["string", "null"] },
        typeId: { type: ["number", "null"], description: "Ticket type ID, or null to clear" },
        parentId: { type: ["number", "null"], description: "Parent/epic task ID, or null to unlink" },
        archived: { type: "boolean", description: "true removes a done task from the board, false puts it back" },
      },
      required: ["id"],
    },
    handler: async (args, api) => {
      const { id, archived, ...body } = z
        .object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          status: z.enum(STATUSES).optional(),
          priority: z.enum(PRIORITIES).optional(),
          assigneeId: z.number().nullable().optional(),
          dueDate: z.string().nullable().optional(),
          typeId: z.number().nullable().optional(),
          parentId: z.number().nullable().optional(),
          archived: z.boolean().optional(),
        })
        .parse(args);

      let task: Task | undefined;
      if (Object.keys(body).length > 0) task = await api.patch<Task>(`/api/tasks/${id}`, body);
      if (archived !== undefined) task = await api.patch<Task>(`/api/tasks/${id}/archive`, { archived });
      task ??= await api.get<Task>(`/api/tasks/${id}`);
      return ok(formatTask(task));
    },
  },
  {
    name: "move_task",
    description: "Move a task to another kanban column",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Task ID" },
        status: { type: "string", enum: STATUSES, description: "New column" },
      },
      required: ["id", "status"],
    },
    handler: async (args, api) => {
      const { id, status } = z.object({ id: z.number(), status: z.enum(STATUSES) }).parse(args);
      return ok(formatTask(await api.patch<Task>(`/api/tasks/${id}/move`, { status, position: 0 })));
    },
  },
];
