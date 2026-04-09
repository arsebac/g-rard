import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";

// Génère un slug depuis un titre
function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // enlève les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// Génère un slug unique en ajoutant un suffixe si nécessaire
async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  let slug = base || "page";
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
  contentType: z.enum(["tiptap", "markdown"]).optional(),
});

const updatePageSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().optional().nullable(),
});

export default async function wikiRoutes(app: FastifyInstance) {
  // GET /api/wiki — toutes les pages
  app.get("/api/wiki", { preHandler: requireAuth }, async (_req, reply) => {
    const pages = await db.wikiPage.findMany({
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

  // GET /api/projects/:id/wiki — pages d'un projet
  app.get("/api/projects/:id/wiki", { preHandler: requireAuth }, async (req, reply) => {
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

  // POST /api/wiki/pages — créer une page
  app.post("/api/wiki/pages", { preHandler: requireAuth }, async (req, reply) => {
    const body = createPageSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const { title, projectId, parentId, body: content, contentType } = body.data;
    const baseSlug = slugify(title);
    const slug = await uniqueSlug(baseSlug);

    const page = await db.wikiPage.create({
      data: {
        title,
        slug,
        body: content ?? "",
        contentType: contentType ?? "tiptap",
        creator: { connect: { id: req.currentUserId } },
        ...(projectId ? { project: { connect: { id: projectId } } } : {}),
        ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
      },
    });

    return reply.status(201).send(page);
  });

  // GET /api/wiki/pages/:id — détail d'une page
  app.get("/api/wiki/pages/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const page = await db.wikiPage.findUnique({
      where: { id: parseInt(id) },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        children: {
          select: { id: true, title: true, slug: true, parentId: true },
          orderBy: { title: "asc" },
        },
      },
    });
    if (!page) return reply.status(404).send({ error: "Page introuvable" });
    return reply.send(page);
  });

  // PATCH /api/wiki/pages/:id — modifier une page
  app.patch("/api/wiki/pages/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updatePageSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const data: Record<string, unknown> = {};
    if (body.data.title !== undefined) {
      data.title = body.data.title;
      const baseSlug = slugify(body.data.title);
      data.slug = await uniqueSlug(baseSlug, parseInt(id));
    }
    if (body.data.body !== undefined) {
      data.body = body.data.body ?? "";
    }

    const page = await db.wikiPage.update({
      where: { id: parseInt(id) },
      data,
    });

    return reply.send(page);
  });

  // DELETE /api/wiki/pages/:id — supprimer une page
  app.delete("/api/wiki/pages/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    // Détacher les enfants avant suppression
    await db.wikiPage.updateMany({
      where: { parentId: parseInt(id) },
      data: { parentId: null },
    });
    await db.wikiPage.delete({ where: { id: parseInt(id) } });
    return reply.send({ ok: true });
  });

  // GET /api/wiki/pages/:id/export-md — exporter en Markdown
  app.get("/api/wiki/pages/:id/export-md", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const page = await db.wikiPage.findUnique({ where: { id: parseInt(id) } });
    if (!page) return reply.status(404).send({ error: "Page introuvable" });

    const filename = `${page.slug}.md`;
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    reply.header("Content-Type", "text/markdown");
    return reply.send(page.body);
  });

  // POST /api/wiki/pages/import-md — importer un fichier Markdown
  app.post("/api/wiki/pages/import-md", { preHandler: requireAuth }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "Fichier requis" });

    const content = await data.toBuffer();
    const title = data.filename.replace(/\.md$/i, "");
    const baseSlug = slugify(title);
    const slug = await uniqueSlug(baseSlug);

    const page = await db.wikiPage.create({
      data: {
        title,
        slug,
        body: content.toString("utf-8"),
        contentType: "markdown",
        creator: { connect: { id: req.currentUserId } },
      },
    });

    return reply.status(201).send(page);
  });
}
