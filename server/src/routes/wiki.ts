import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireProjectViewer, ensureProjectAccess, ProjectAccessLevel } from "../plugins/auth";
import { sanitizeHtml } from "../services/sanitize";

export const SLUG_PATTERN = /^(?=.*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugField = z
  .string()
  .max(100)
  .regex(SLUG_PATTERN, "Slug must be lowercase letters, digits and dashes, with at least one letter");

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// Slugs are unique across the whole wiki (not only per project) so a slug alone identifies a page.
async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  const slug = !base ? "page" : /[a-z]/.test(base) ? base : `page-${base}`;
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const existing = await db.wikiPage.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (!existing) return candidate;
    attempt++;
  }
}

const createPageSchema = z.object({
  title: z.string().min(1).max(500),
  projectId: z.number().optional().nullable(),
  parentId: z.number().optional().nullable(),
  body: z.string().optional().nullable(),
  slug: slugField.optional(),
});

const updatePageSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().optional().nullable(),
  slug: slugField.optional(),
});

async function isSlugTaken(slug: string, excludeId?: number): Promise<boolean> {
  const existing = await db.wikiPage.findFirst({
    where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  return existing !== null;
}

// A page reference is either a numeric ID or a slug (slugs always contain a letter).
function pageWhere(ref: string) {
  return /^\d+$/.test(ref) ? { id: parseInt(ref) } : { slug: ref };
}

const pageDetailInclude = {
  creator: { select: { id: true, name: true, avatarUrl: true } },
  children: {
    select: { id: true, title: true, slug: true, parentId: true },
    orderBy: { title: "asc" as const },
  },
};

function snippet(body: string, q: string): string {
  const index = body.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return body.slice(0, 160);
  const start = Math.max(0, index - 60);
  return (start > 0 ? "…" : "") + body.slice(start, index + q.length + 100) + (index + q.length + 100 < body.length ? "…" : "");
}

// Pages without a project form the shared wiki, open to every signed-in user.
async function canAccessPage(
  req: FastifyRequest,
  reply: FastifyReply,
  projectId: number | null | undefined,
  level: ProjectAccessLevel
): Promise<boolean> {
  if (projectId == null) return true;
  return ensureProjectAccess(req, reply, projectId, level);
}

export default async function wikiRoutes(app: FastifyInstance) {
  // GET /api/wiki — all pages
  app.get("/api/wiki", { preHandler: requireAuth }, async (req, reply) => {
    const pages = await db.wikiPage.findMany({
      where: {
        OR: [{ projectId: null }, { project: { members: { some: { userId: req.currentUserId } } } }],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        projectId: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { title: "asc" },
    });
    return reply.send(pages);
  });

  // GET /api/projects/:id/wiki — pages of a project
  app.get("/api/projects/:id/wiki", { preHandler: [requireAuth, requireProjectViewer] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const pages = await db.wikiPage.findMany({
      where: { projectId: parseInt(id) },
      select: {
        id: true,
        title: true,
        slug: true,
        projectId: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { title: "asc" },
    });
    return reply.send(pages);
  });

  // POST /api/wiki/pages — create a page
  app.post("/api/wiki/pages", { preHandler: requireAuth }, async (req, reply) => {
    const body = createPageSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const { title, projectId, parentId, body: content, slug: requestedSlug } = body.data;

    if (projectId && !(await ensureProjectAccess(req, reply, projectId, "write"))) return reply;
    if (parentId) {
      const parent = await db.wikiPage.findUnique({ where: { id: parentId }, select: { projectId: true } });
      if (!parent) return reply.status(404).send({ error: "Parent page not found" });
      if (!(await canAccessPage(req, reply, parent.projectId, "write"))) return reply;
    }
    if (requestedSlug && (await isSlugTaken(requestedSlug))) {
      return reply.status(409).send({ error: "Slug already used by another page" });
    }
    const slug = requestedSlug ?? (await uniqueSlug(slugify(title)));

    const page = await db.wikiPage.create({
      data: {
        title: sanitizeHtml(title),
        slug,
        body: content ?? "",
        creator: { connect: { id: req.currentUserId } },
        ...(projectId ? { project: { connect: { id: projectId } } } : {}),
        ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
      },
    });

    return reply.status(201).send(page);
  });

  // GET /api/wiki/search?q=&projectId= — case-insensitive search in title, slug and body
  app.get("/api/wiki/search", { preHandler: requireAuth }, async (req, reply) => {
    const query = req.query as { q?: string; projectId?: string };
    const q = query.q?.trim();
    if (!q || q.length < 2) return reply.send([]);
    const projectId = query.projectId ? parseInt(query.projectId) : undefined;

    const pages = await db.wikiPage.findMany({
      where: {
        AND: [
          { OR: [{ projectId: null }, { project: { members: { some: { userId: req.currentUserId } } } }] },
          projectId !== undefined ? { projectId } : {},
          { OR: [{ title: { contains: q } }, { slug: { contains: q } }, { body: { contains: q } }] },
        ],
      },
      select: { id: true, title: true, slug: true, projectId: true, parentId: true, body: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const lower = q.toLowerCase();
    const titleMatch = (p: { title: string; slug: string }) =>
      p.title.toLowerCase().includes(lower) || p.slug.includes(lower) ? 0 : 1;
    pages.sort((a, b) => titleMatch(a) - titleMatch(b));

    return reply.send(
      pages.slice(0, 30).map(({ body, ...p }) => ({ ...p, snippet: snippet(body, q) }))
    );
  });

  // GET /api/wiki/pages/:ref — page detail, by numeric ID or slug
  app.get("/api/wiki/pages/:ref", { preHandler: requireAuth }, async (req, reply) => {
    const { ref } = req.params as { ref: string };
    const page = await db.wikiPage.findFirst({ where: pageWhere(ref), include: pageDetailInclude });
    if (!page) return reply.status(404).send({ error: "Page not found" });
    if (!(await canAccessPage(req, reply, page.projectId, "read"))) return reply;
    return reply.send(page);
  });

  // PATCH /api/wiki/pages/:ref — update a page, by numeric ID or slug
  app.patch("/api/wiki/pages/:ref", { preHandler: requireAuth }, async (req, reply) => {
    const { ref } = req.params as { ref: string };
    const body = updatePageSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const existing = await db.wikiPage.findFirst({ where: pageWhere(ref), select: { id: true, projectId: true } });
    if (!existing) return reply.status(404).send({ error: "Page not found" });
    if (!(await canAccessPage(req, reply, existing.projectId, "write"))) return reply;

    // Renaming a page keeps its slug so links and agent references stay valid.
    const data: Record<string, unknown> = {};
    if (body.data.title !== undefined) {
      data.title = sanitizeHtml(body.data.title);
    }
    if (body.data.slug !== undefined) {
      if (await isSlugTaken(body.data.slug, existing.id)) {
        return reply.status(409).send({ error: "Slug already used by another page" });
      }
      data.slug = body.data.slug;
    }
    if (body.data.body !== undefined) {
      data.body = body.data.body ?? "";
    }

    const page = await db.wikiPage.update({
      where: { id: existing.id },
      data,
    });

    return reply.send(page);
  });

  // DELETE /api/wiki/pages/:ref — delete a page, by numeric ID or slug
  app.delete("/api/wiki/pages/:ref", { preHandler: requireAuth }, async (req, reply) => {
    const { ref } = req.params as { ref: string };
    const existing = await db.wikiPage.findFirst({ where: pageWhere(ref), select: { id: true, projectId: true } });
    if (!existing) return reply.status(404).send({ error: "Page not found" });
    if (!(await canAccessPage(req, reply, existing.projectId, "write"))) return reply;

    // Detach children before deleting
    await db.wikiPage.updateMany({
      where: { parentId: existing.id },
      data: { parentId: null },
    });
    await db.wikiPage.delete({ where: { id: existing.id } });
    return reply.send({ ok: true });
  });

  // GET /api/wiki/pages/:id/export-md — export as Markdown
  app.get("/api/wiki/pages/:id/export-md", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const page = await db.wikiPage.findUnique({ where: { id: parseInt(id) } });
    if (!page) return reply.status(404).send({ error: "Page not found" });
    if (!(await canAccessPage(req, reply, page.projectId, "read"))) return reply;

    const filename = `${page.slug}.md`;
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    reply.header("Content-Type", "text/markdown");
    return reply.send(page.body);
  });

  // POST /api/wiki/pages/import-md — import a Markdown file
  app.post("/api/wiki/pages/import-md", { preHandler: requireAuth }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "Fichier requis" });

    const content = await data.toBuffer();
    const title = data.filename.replace(/\.md$/i, "");
    const baseSlug = slugify(title);
    const slug = await uniqueSlug(baseSlug);

    const page = await db.wikiPage.create({
      data: {
        title: sanitizeHtml(title),
        slug,
        body: content.toString("utf-8"),
        creator: { connect: { id: req.currentUserId } },
      },
    });

    return reply.status(201).send(page);
  });
}
