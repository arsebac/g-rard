import { z } from "zod";
import type { WikiPage } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

const pageIdSchema = {
  type: "object" as const,
  properties: { id: { type: "number", description: "Wiki page ID" } },
  required: ["id"],
};
const pageIdArgs = z.object({ id: z.number() });

const summary = (p: WikiPage) => ({ id: p.id, title: p.title, slug: p.slug });

export const wikiTools: Tool[] = [
  {
    name: "list_wiki_pages",
    description: "List wiki pages for a project (or global wiki if no projectId)",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "number", description: "Project ID (optional)" } },
    },
    handler: async (args, api) => {
      const { projectId } = z.object({ projectId: z.number().optional() }).parse(args ?? {});
      const pages = await api.get<WikiPage[]>(projectId !== undefined ? `/api/projects/${projectId}/wiki` : "/api/wiki");
      return ok(pages.map((p) => ({ ...summary(p), parentId: p.parentId, updatedAt: p.updatedAt })));
    },
  },
  {
    name: "get_wiki_page",
    description: "Retrieve a wiki page content by ID",
    inputSchema: pageIdSchema,
    handler: async (args, api) => {
      const { id } = pageIdArgs.parse(args);
      return ok(await api.get<WikiPage>(`/api/wiki/pages/${id}`));
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
    handler: async (args, api) => {
      const data = z
        .object({
          projectId: z.number().optional(),
          parentId: z.number().optional(),
          title: z.string().min(1),
          body: z.string(),
        })
        .parse(args);
      return ok(summary(await api.post<WikiPage>("/api/wiki/pages", data)));
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
    handler: async (args, api) => {
      const { id, ...body } = z
        .object({ id: z.number(), title: z.string().optional(), body: z.string().optional() })
        .parse(args);
      return ok(summary(await api.patch<WikiPage>(`/api/wiki/pages/${id}`, body)));
    },
  },
  {
    name: "delete_wiki_page",
    description: "Delete a wiki page",
    inputSchema: pageIdSchema,
    handler: async (args, api) => {
      const { id } = pageIdArgs.parse(args);
      await api.delete(`/api/wiki/pages/${id}`);
      return ok({ success: true });
    },
  },
];
