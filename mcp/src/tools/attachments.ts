import { z } from "zod";
import type { Attachment } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

export const attachmentTools: Tool[] = [
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
    handler: async (args, api) => {
      const { entityType, entityId } = z
        .object({ entityType: z.enum(["task", "project", "wiki_page"]), entityId: z.number() })
        .parse(args);
      const attachments = await api.get<Attachment[]>(`/api/attachments?entityType=${entityType}&entityId=${entityId}`);
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
    },
  },
];
