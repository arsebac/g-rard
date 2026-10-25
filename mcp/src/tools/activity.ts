import { z } from "zod";
import type { ActivityLog } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

export const activityTools: Tool[] = [
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
    handler: async (args, api) => {
      const { entityType, entityId, limit } = z
        .object({ entityType: z.enum(["task", "project"]), entityId: z.number(), limit: z.number().default(20) })
        .parse(args);
      const path = entityType === "task" ? `/api/tasks/${entityId}/activity` : `/api/projects/${entityId}/activity`;
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
    },
  },
];
