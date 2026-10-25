import { z } from "zod";
import type { Label } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

const taskLabelSchema = {
  type: "object" as const,
  properties: {
    taskId: { type: "number", description: "Task ID" },
    labelId: { type: "number", description: "Label ID" },
  },
  required: ["taskId", "labelId"],
};
const taskLabelArgs = z.object({ taskId: z.number(), labelId: z.number() });

export const labelTools: Tool[] = [
  {
    name: "list_labels",
    description: "List available labels for a project",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "number", description: "Project ID" } },
      required: ["projectId"],
    },
    handler: async (args, api) => {
      const { projectId } = z.object({ projectId: z.number() }).parse(args);
      return ok(await api.get<Label[]>(`/api/projects/${projectId}/labels`));
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
    handler: async (args, api) => {
      const { projectId, ...body } = z
        .object({ projectId: z.number(), name: z.string().min(1), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
        .parse(args);
      return ok(await api.post<Label>(`/api/projects/${projectId}/labels`, body));
    },
  },
  {
    name: "add_label_to_task",
    description: "Assign a label to a task",
    inputSchema: taskLabelSchema,
    handler: async (args, api) => {
      const { taskId, labelId } = taskLabelArgs.parse(args);
      await api.post(`/api/tasks/${taskId}/labels/${labelId}`, {});
      return ok({ success: true });
    },
  },
  {
    name: "remove_label_from_task",
    description: "Remove a label from a task",
    inputSchema: taskLabelSchema,
    handler: async (args, api) => {
      const { taskId, labelId } = taskLabelArgs.parse(args);
      await api.delete(`/api/tasks/${taskId}/labels/${labelId}`);
      return ok({ success: true });
    },
  },
];
