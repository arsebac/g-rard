import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { storageService } from "../services/storage";

const createSpaceSchema = z.object({
  name: z.string().min(1).max(255),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().optional().nullable(),
  parentId: z.number().optional().nullable(),
  position: z.number().optional(),
});

const updateSpaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().optional().nullable(),
  position: z.number().optional(),
});

export default async function documentRoutes(app: FastifyInstance) {
  // GET /api/document-spaces — flat list of all spaces
  app.get("/api/document-spaces", { preHandler: requireAuth }, async (_req, reply) => {
    const spaces = await db.documentSpace.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { documents: true, children: true } },
      },
    });
    return reply.send(spaces);
  });

  // POST /api/document-spaces — create a space
  app.post("/api/document-spaces", { preHandler: requireAuth }, async (req, reply) => {
    const body = createSpaceSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
    }

    const { name, icon, color, description, parentId, position } = body.data;

    if (parentId) {
      const parent = await db.documentSpace.findUnique({ where: { id: parentId } });
      if (!parent) return reply.status(404).send({ error: "Parent space not found" });
      if (parent.parentId !== null) {
        return reply.status(400).send({ error: "Nesting limited to 2 levels" });
      }
    }

    const space = await db.documentSpace.create({
      data: {
        name,
        icon: icon ?? "folder",
        color: color ?? "#6366f1",
        description: description ?? null,
        parentId: parentId ?? null,
        position: position ?? 0,
      },
    });

    return reply.status(201).send(space);
  });

  // PATCH /api/document-spaces/:id — update a space
  app.patch("/api/document-spaces/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateSpaceSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
    }

    const space = await db.documentSpace.findUnique({ where: { id: parseInt(id) } });
    if (!space) return reply.status(404).send({ error: "Space not found" });

    const updated = await db.documentSpace.update({
      where: { id: parseInt(id) },
      data: body.data,
    });

    return reply.send(updated);
  });

  // DELETE /api/document-spaces/:id — delete a space (cascade handled by DB)
  app.delete("/api/document-spaces/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const spaceId = parseInt(id);

    const space = await db.documentSpace.findUnique({ where: { id: spaceId } });
    if (!space) return reply.status(404).send({ error: "Space not found" });

    // Collect all documents in this space and its children for file cleanup
    const childSpaces = await db.documentSpace.findMany({ where: { parentId: spaceId }, select: { id: true } });
    const childIds = childSpaces.map((s: { id: number }) => s.id);

    const docsToDelete = await db.document.findMany({
      where: { spaceId: { in: [spaceId, ...childIds] } },
      select: { storedPath: true },
    });

    await db.documentSpace.delete({ where: { id: spaceId } });

    // Clean up files after DB delete
    for (const doc of docsToDelete) {
      await storageService.deleteFile(doc.storedPath).catch(() => {});
    }

    return reply.send({ ok: true });
  });

  // GET /api/document-spaces/:id/documents — list documents in a space
  app.get("/api/document-spaces/:id/documents", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const space = await db.documentSpace.findUnique({ where: { id: parseInt(id) } });
    if (!space) return reply.status(404).send({ error: "Space not found" });

    const documents = await db.document.findMany({
      where: { spaceId: parseInt(id) },
      include: {
        uploader: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(documents);
  });

  // POST /api/document-spaces/:id/documents — upload a document
  app.post("/api/document-spaces/:id/documents", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const spaceId = parseInt(id);

    const space = await db.documentSpace.findUnique({ where: { id: spaceId } });
    if (!space) return reply.status(404).send({ error: "Space not found" });

    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file provided" });

    const title = (data.fields.title as any)?.value as string | undefined;
    const description = (data.fields.description as any)?.value as string | undefined;

    try {
      const storedPath = await storageService.saveFile(data.file, data.filename);

      const doc = await db.document.create({
        data: {
          spaceId,
          title: title || data.filename,
          description: description || null,
          uploadedBy: req.currentUserId,
          filename: data.filename,
          storedPath,
          mimeType: data.mimetype,
          sizeBytes: 0,
        },
        include: {
          uploader: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      return reply.status(201).send(doc);
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({ error: err.message || "Error while saving the file" });
    }
  });

  // PATCH /api/documents/:id — update title/description
  app.patch("/api/documents/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({ title: z.string().min(1).max(500).optional(), description: z.string().nullable().optional() })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid data" });

    const doc = await db.document.findUnique({ where: { id: parseInt(id) } });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    const updated = await db.document.update({
      where: { id: parseInt(id) },
      data: body.data,
    });

    return reply.send(updated);
  });

  // GET /api/documents/:id/download — download a document
  app.get("/api/documents/:id/download", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await db.document.findUnique({ where: { id: parseInt(id) } });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    reply.header("Content-Disposition", `attachment; filename="${doc.filename}"`);
    reply.header("Content-Type", doc.mimeType);
    return reply.send(storageService.getStream(doc.storedPath));
  });

  // DELETE /api/documents/:id — delete a document
  app.delete("/api/documents/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await db.document.findUnique({ where: { id: parseInt(id) } });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    await storageService.deleteFile(doc.storedPath).catch(() => {});
    await db.document.delete({ where: { id: parseInt(id) } });

    return reply.send({ ok: true });
  });
}
