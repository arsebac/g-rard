import { z } from "zod";
import type { RecurringTask } from "../types.js";
import type { Tool } from "./types.js";
import { ok, PRIORITIES } from "./types.js";

const RECURRENCE_TYPES = ["EVERY_N_WEEKS", "MONTHLY_BEFORE_END", "CUSTOM_DATES"] as const;

const summary = (r: RecurringTask) => ({
  id: r.id,
  title: r.title,
  recurrenceType: r.recurrenceType,
  taskCount: r._count?.tasks ?? 0,
});

export const recurringTaskTools: Tool[] = [
  {
    name: "list_recurring_tasks",
    description: "List recurring task templates for a project",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "number", description: "Project ID" } },
      required: ["projectId"],
    },
    handler: async (args, api) => {
      const { projectId } = z.object({ projectId: z.number() }).parse(args);
      const templates = await api.get<RecurringTask[]>(`/api/projects/${projectId}/recurring-tasks`);
      return ok(
        templates.map((r) => ({
          ...summary(r),
          intervalWeeks: r.intervalWeeks,
          daysBeforeEndOfMonth: r.daysBeforeEndOfMonth,
          customDates: r.customDates,
          priority: r.priority,
        }))
      );
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
        recurrenceType: { type: "string", enum: RECURRENCE_TYPES, description: "Recurrence type" },
        intervalWeeks: { type: "number", description: "Interval in weeks (for EVERY_N_WEEKS)" },
        daysBeforeEndOfMonth: { type: "number", description: "Days before end of month (for MONTHLY_BEFORE_END)" },
        customDates: {
          type: "array",
          items: { type: "string" },
          description: "Specific dates in YYYY-MM-DD format (for CUSTOM_DATES)",
        },
        priority: { type: "string", enum: PRIORITIES },
        assigneeId: { type: "number", description: "ID of the assigned user" },
        description: { type: "string" },
      },
      required: ["projectId", "title", "recurrenceType"],
    },
    handler: async (args, api) => {
      const { projectId, ...body } = z
        .object({
          projectId: z.number(),
          title: z.string().min(1),
          recurrenceType: z.enum(RECURRENCE_TYPES),
          intervalWeeks: z.number().optional(),
          daysBeforeEndOfMonth: z.number().optional(),
          customDates: z.array(z.string()).optional(),
          priority: z.enum(PRIORITIES).optional(),
          assigneeId: z.number().optional(),
          description: z.string().optional(),
        })
        .parse(args);
      return ok(summary(await api.post<RecurringTask>(`/api/projects/${projectId}/recurring-tasks`, body)));
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
        recurrenceType: { type: "string", enum: RECURRENCE_TYPES },
        intervalWeeks: { type: "number" },
        daysBeforeEndOfMonth: { type: "number" },
        customDates: { type: "array", items: { type: "string" } },
        priority: { type: "string", enum: PRIORITIES },
        assigneeId: { type: ["number", "null"] },
      },
      required: ["id"],
    },
    handler: async (args, api) => {
      const { id, ...body } = z
        .object({
          id: z.number(),
          title: z.string().optional(),
          recurrenceType: z.enum(RECURRENCE_TYPES).optional(),
          intervalWeeks: z.number().optional(),
          daysBeforeEndOfMonth: z.number().optional(),
          customDates: z.array(z.string()).optional(),
          priority: z.enum(PRIORITIES).optional(),
          assigneeId: z.number().nullable().optional(),
        })
        .parse(args);
      return ok(summary(await api.patch<RecurringTask>(`/api/recurring-tasks/${id}`, body)));
    },
  },
  {
    name: "regenerate_recurring_task",
    description:
      "Regenerate future occurrences of a recurring task. Use after receiving a schedule (e.g., trash collection schedule) to replace future dates with provided ones.",
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
    handler: async (args, api) => {
      const { id, customDates } = z.object({ id: z.number(), customDates: z.array(z.string()).optional() }).parse(args);
      const template = await api.post<RecurringTask>(`/api/recurring-tasks/${id}/regenerate`, { customDates });
      return ok({ id: template.id, title: template.title, taskCount: template._count?.tasks ?? 0 });
    },
  },
];
