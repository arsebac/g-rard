import { z } from "zod";
import type { Sprint } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

const SPRINT_STATUSES = ["futur", "actif", "termine"] as const;

export const sprintTools: Tool[] = [
  {
    name: "list_sprints",
    description: "List sprints for a project",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "number", description: "Project ID" } },
      required: ["projectId"],
    },
    handler: async (args, api) => {
      const { projectId } = z.object({ projectId: z.number() }).parse(args);
      const sprints = await api.get<Sprint[]>(`/api/projects/${projectId}/sprints`);
      return ok(
        sprints.map((s) => ({ id: s.id, name: s.name, status: s.status, goal: s.goal, taskCount: s._count?.tasks ?? 0 }))
      );
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
    handler: async (args, api) => {
      const { projectId, ...body } = z
        .object({
          projectId: z.number(),
          name: z.string().min(1),
          goal: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .parse(args);
      return ok(await api.post<Sprint>(`/api/projects/${projectId}/sprints`, body));
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
        status: { type: "string", enum: SPRINT_STATUSES },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["id"],
    },
    handler: async (args, api) => {
      const { id, ...body } = z
        .object({
          id: z.number(),
          name: z.string().optional(),
          goal: z.string().optional(),
          status: z.enum(SPRINT_STATUSES).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .parse(args);
      return ok(await api.patch<Sprint>(`/api/sprints/${id}`, body));
    },
  },
];
