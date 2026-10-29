import { z } from "zod";
import type { WikiPage } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

const pageRefProperties = {
  id: { type: "number", description: "Wiki page ID" },
  slug: { type: "string", description: "Wiki page slug, e.g. deploy-recipe (alternative to id)" },
};
const pageRefSchema = { type: "object" as const, properties: pageRefProperties };
const pageRefArgs = z
  .object({ id: z.number().optional(), slug: z.string().min(1).optional() })
  .refine((a) => a.id !== undefined || a.slug !== undefined, { message: "Either id or slug is required" });
const pagePath = (a: { id?: number; slug?: string }) =>
  `/api/wiki/pages/${a.id !== undefined ? a.id : encodeURIComponent(a.slug!)}`;

const slugDescription =
  "Unique short identifier: lowercase letters, digits and dashes, at least one letter (e.g. deploy-recipe)";

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
    name: "search_wiki_pages",
    description:
      "Search wiki pages by keywords (case-insensitive, in title, slug and content). Returns id, slug, title and a snippet; title matches come first.",
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
      return ok(await api.get<unknown[]>(`/api/wiki/search?${params}`));
    },
  },
  {
    name: "get_wiki_page",
    description: "Retrieve a wiki page content by ID or slug",
    inputSchema: pageRefSchema,
    handler: async (args, api) => {
      return ok(await api.get<WikiPage>(pagePath(pageRefArgs.parse(args))));
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
        slug: { type: "string", description: `${slugDescription}. Derived from the title if omitted.` },
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
          slug: z.string().optional(),
        })
        .parse(args);
      return ok(summary(await api.post<WikiPage>("/api/wiki/pages", data)));
    },
  },
  {
    name: "update_wiki_page",
    description: "Modify an existing wiki page, found by ID or slug. Renaming keeps the slug unless newSlug is given.",
    inputSchema: {
      type: "object",
      properties: {
        ...pageRefProperties,
        title: { type: "string", description: "New title" },
        body: { type: "string", description: "New content" },
        newSlug: { type: "string", description: `New slug. ${slugDescription}` },
      },
    },
    handler: async (args, api) => {
      const { title, body, newSlug } = z
        .object({ title: z.string().optional(), body: z.string().optional(), newSlug: z.string().optional() })
        .parse(args);
      const ref = pageRefArgs.parse(args);
      return ok(summary(await api.patch<WikiPage>(pagePath(ref), { title, body, slug: newSlug })));
    },
  },
  {
    name: "delete_wiki_page",
    description: "Delete a wiki page, found by ID or slug",
    inputSchema: pageRefSchema,
    handler: async (args, api) => {
      await api.delete(pagePath(pageRefArgs.parse(args)));
      return ok({ success: true });
    },
  },
];
