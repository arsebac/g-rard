import { z } from "zod";
import type { Comment } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

export const commentTools: Tool[] = [
  {
    name: "list_comments",
    description: "List comments for a task",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "number", description: "Task ID" } },
      required: ["taskId"],
    },
    handler: async (args, api) => {
      const { taskId } = z.object({ taskId: z.number() }).parse(args);
      const comments = await api.get<Comment[]>(`/api/tasks/${taskId}/comments`);
      return ok(comments.map((c) => ({ id: c.id, author: c.author.name, body: c.body, createdAt: c.createdAt })));
    },
  },
  {
    name: "add_comment",
    description: "Add a comment to a task",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "Task ID" },
        body: { type: "string", description: "Comment body, in Markdown (GFM). Ticket refs like DEV-12 become links." },
      },
      required: ["taskId", "body"],
    },
    handler: async (args, api) => {
      const { taskId, body } = z.object({ taskId: z.number(), body: z.string().min(1) }).parse(args);
      return ok(await api.post<Comment>(`/api/tasks/${taskId}/comments`, { body }));
    },
  },
];
