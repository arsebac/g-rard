import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { storageService } from "../services/storage";
import { DocumentSpaceMemberRole } from "@prisma/client";

// ─── Permission helper ────────────────────────────────────────────────────────

/**
 * Returns the role of userId in the given space (or its parent for sub-spaces).
 * Returns null if the user has no access.
 */
async function getSpaceRole(
  userId: number,
  spaceId: number
): Promise<DocumentSpaceMemberRole | null> {
  const space = await db.documentSpace.findUnique({
    where: { id: spaceId },
    include: {
      members: { where: { userId } },
      parent: { include: { members: { where: { userId } } } },
    },
  });
  if (!space) return null;
  if (space.members[0]) return space.members[0].role;
  if (space.parent?.members[0]) return space.parent.members[0].role;
  return null;
}

function canWrite(role: DocumentSpaceMemberRole | null): boolean {
  return role === "owner" || role === "editor";
}

function canManage(role: DocumentSpaceMemberRole | null): boolean {
  return role === "owner";
}

// ─── Validation schemas ───────────────────────────────────────────────────────

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

const addMemberSchema = z.object({
  userId: z.number(),
  role: z.enum(["editor", "viewer"]),
});

const updateMemberSchema = z.object({
  role: z.enum(["editor", "viewer"]),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export default async function documentRoutes(app: FastifyInstance) {
  // GET /api/document-spaces — spaces accessible to the current user
  app.get("/api/document-spaces", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.currentUserId;

    // Top-level spaces where user is a member
    const memberOf = await db.documentSpaceMember.findMany({
      where: { userId },
      select: { spaceId: true },
    });
    const topLevelIds = memberOf.map((m: { spaceId: number }) => m.spaceId);

    const spaces = await db.documentSpace.findMany({
      where: {
        OR: [
          { id: { in: topLevelIds } },
          { parentId: { in: topLevelIds } },
        ],
      },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { documents: true, children: true } },
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
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
      // Check write access to parent
      const role = await getSpaceRole(req.currentUserId, parentId);
      if (!canWrite(role)) {
        return reply.status(403).send({ error: "Write access required on parent space" });
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
        // Auto-add creator as owner for top-level spaces
        ...(parentId
          ? {}
          : {
              members: {
                create: { userId: req.currentUserId, role: "owner" },
              },
            }),
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    return reply.status(201).send(space);
  });

  // PATCH /api/document-spaces/:id — update a space (owner or editor)
  app.patch("/api/document-spaces/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const spaceId = parseInt(id);
    const body = updateSpaceSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
    }

    const role = await getSpaceRole(req.currentUserId, spaceId);
    if (!canWrite(role)) return reply.status(403).send({ error: "Write access required" });

    const space = await db.documentSpace.findUnique({ where: { id: spaceId } });
    if (!space) return reply.status(404).send({ error: "Space not found" });

    const updated = await db.documentSpace.update({
      where: { id: spaceId },
      data: body.data,
    });

    return reply.send(updated);
  });

  // DELETE /api/document-spaces/:id — delete a space (owner only)
  app.delete("/api/document-spaces/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const spaceId = parseInt(id);

    const role = await getSpaceRole(req.currentUserId, spaceId);
    if (!canManage(role)) return reply.status(403).send({ error: "Owner access required" });

    const space = await db.documentSpace.findUnique({ where: { id: spaceId } });
    if (!space) return reply.status(404).send({ error: "Space not found" });

    const childSpaces = await db.documentSpace.findMany({
      where: { parentId: spaceId },
      select: { id: true },
    });
    const childIds = childSpaces.map((s: { id: number }) => s.id);

    const docsToDelete = await db.document.findMany({
      where: { spaceId: { in: [spaceId, ...childIds] } },
      select: { storedPath: true },
    });

    await db.documentSpace.delete({ where: { id: spaceId } });

    for (const doc of docsToDelete) {
      await storageService.deleteFile(doc.storedPath).catch(() => {});
    }

    return reply.send({ ok: true });
  });

  // ─── Member management (top-level spaces only) ───────────────────────────────

  // GET /api/document-spaces/:id/members
  app.get("/api/document-spaces/:id/members", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const spaceId = parseInt(id);

    const role = await getSpaceRole(req.currentUserId, spaceId);
    if (!role) return reply.status(403).send({ error: "Access denied" });

    const members = await db.documentSpaceMember.findMany({
      where: { spaceId },
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    return reply.send(members);
  });

  // POST /api/document-spaces/:id/members — add a member (owner only)
  app.post("/api/document-spaces/:id/members", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const spaceId = parseInt(id);

    const role = await getSpaceRole(req.currentUserId, spaceId);
    if (!canManage(role)) return reply.status(403).send({ error: "Owner access required" });

    const space = await db.documentSpace.findUnique({ where: { id: spaceId } });
    if (!space) return reply.status(404).send({ error: "Space not found" });
    if (space.parentId !== null) {
      return reply.status(400).send({ error: "Members can only be added to top-level spaces" });
    }

    const body = addMemberSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid data" });

    const { userId, role: memberRole } = body.data;

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: "User not found" });

    const member = await db.documentSpaceMember.upsert({
      where: { spaceId_userId: { spaceId, userId } },
      create: { spaceId, userId, role: memberRole },
      update: { role: memberRole },
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
    });

    return reply.status(201).send(member);
  });

  // PATCH /api/document-spaces/:id/members/:userId — change role (owner only)
  app.patch(
    "/api/document-spaces/:id/members/:userId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id, userId: targetUserIdStr } = req.params as { id: string; userId: string };
      const spaceId = parseInt(id);
      const targetUserId = parseInt(targetUserIdStr);

      const role = await getSpaceRole(req.currentUserId, spaceId);
      if (!canManage(role)) return reply.status(403).send({ error: "Owner access required" });

      if (targetUserId === req.currentUserId) {
        return reply.status(400).send({ error: "Cannot change your own role" });
      }

      const body = updateMemberSchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: "Invalid data" });

      const existing = await db.documentSpaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId: targetUserId } },
      });
      if (!existing) return reply.status(404).send({ error: "Member not found" });

      const updated = await db.documentSpaceMember.update({
        where: { spaceId_userId: { spaceId, userId: targetUserId } },
        data: { role: body.data.role },
        include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      });

      return reply.send(updated);
    }
  );

  // DELETE /api/document-spaces/:id/members/:userId — remove a member (owner only)
  app.delete(
    "/api/document-spaces/:id/members/:userId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id, userId: targetUserIdStr } = req.params as { id: string; userId: string };
      const spaceId = parseInt(id);
      const targetUserId = parseInt(targetUserIdStr);

      const role = await getSpaceRole(req.currentUserId, spaceId);
      if (!canManage(role)) return reply.status(403).send({ error: "Owner access required" });

      if (targetUserId === req.currentUserId) {
        return reply.status(400).send({ error: "Cannot remove yourself from your own space" });
      }

      await db.documentSpaceMember.delete({
        where: { spaceId_userId: { spaceId, userId: targetUserId } },
      });

      return reply.send({ ok: true });
    }
  );

  // ─── Documents ────────────────────────────────────────────────────────────────

  // GET /api/document-spaces/:id/documents — list documents (any member)
  app.get("/api/document-spaces/:id/documents", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const spaceId = parseInt(id);

    const role = await getSpaceRole(req.currentUserId, spaceId);
    if (!role) return reply.status(403).send({ error: "Access denied" });

    const documents = await db.document.findMany({
      where: { spaceId },
      include: {
        uploader: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(documents);
  });

  // POST /api/document-spaces/:id/documents — upload (owner or editor)
  app.post("/api/document-spaces/:id/documents", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const spaceId = parseInt(id);

    const role = await getSpaceRole(req.currentUserId, spaceId);
    if (!canWrite(role)) return reply.status(403).send({ error: "Write access required" });

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

  // PATCH /api/documents/:id — update title/description (owner or editor)
  app.patch("/api/documents/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({ title: z.string().min(1).max(500).optional(), description: z.string().nullable().optional() })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid data" });

    const doc = await db.document.findUnique({ where: { id: parseInt(id) } });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    const role = await getSpaceRole(req.currentUserId, doc.spaceId);
    if (!canWrite(role)) return reply.status(403).send({ error: "Write access required" });

    const updated = await db.document.update({
      where: { id: parseInt(id) },
      data: body.data,
    });

    return reply.send(updated);
  });

  // GET /api/documents/:id/download — download (any member)
  app.get("/api/documents/:id/download", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await db.document.findUnique({ where: { id: parseInt(id) } });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    const role = await getSpaceRole(req.currentUserId, doc.spaceId);
    if (!role) return reply.status(403).send({ error: "Access denied" });

    reply.header("Content-Disposition", `attachment; filename="${doc.filename}"`);
    reply.header("Content-Type", doc.mimeType);
    return reply.send(storageService.getStream(doc.storedPath));
  });

  // DELETE /api/documents/:id — delete (owner or editor)
  app.delete("/api/documents/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await db.document.findUnique({ where: { id: parseInt(id) } });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    const role = await getSpaceRole(req.currentUserId, doc.spaceId);
    if (!canWrite(role)) return reply.status(403).send({ error: "Write access required" });

    await storageService.deleteFile(doc.storedPath).catch(() => {});
    await db.document.delete({ where: { id: parseInt(id) } });

    return reply.send({ ok: true });
  });
}
