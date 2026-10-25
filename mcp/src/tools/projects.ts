import type { Project } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

export const projectTools: Tool[] = [
  {
    name: "list_projects",
    description: "List all active projects in Gérard",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async (_args, api) => {
      const projects = await api.get<Project[]>("/api/projects");
      return ok(
        projects.map((p) => ({
          id: p.id,
          name: p.name,
          key: p.key,
          description: p.description,
          color: p.color,
          taskCount: p._count?.tasks ?? 0,
          doneVisibility: p.doneVisibility,
          doneVisibilityHours: p.doneVisibilityHours,
        }))
      );
    },
  },
];
