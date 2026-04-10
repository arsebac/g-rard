import { FastifyInstance } from "fastify";
import { db } from "../db";
import { requireAuth, getProjectAccess } from "../plugins/auth";
import { storageService } from "../services/storage";
import { AttachmentType } from "@prisma/client";

/**
 * Récupère le projectId associé à une entité.
 */
async function getProjectIdForEntity(type: AttachmentType, id: number): Promise<number | null> {
  if (type === "project") return id;
  if (type === "task") {
    const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
    return task?.projectId ?? null;
  }
  if (type === "wiki_page") {
    const page = await db.wikiPage.findUnique({ where: { id }, select: { projectId: true } });
    return page?.projectId ?? null;
  }
  return null;
}

export default async function attachmentRoutes(app: FastifyInstance) {
  // GET /api/attachments — liste des pièces jointes pour une entité
  app.get("/api/attachments", { preHandler: requireAuth }, async (req, reply) => {
    const { entityType, entityId } = req.query as { entityType: AttachmentType; entityId: string };
    if (!entityType || !entityId) {
      return reply.status(400).send({ error: "entityType et entityId sont requis" });
    }

    const projectId = await getProjectIdForEntity(entityType, parseInt(entityId));
    if (projectId) {
      const access = await getProjectAccess(req.currentUserId, projectId);
      if (!access) return reply.status(403).send({ error: "Accès refusé" });
    }

    const attachments = await db.attachment.findMany({
      where: {
        entityType,
        entityId: parseInt(entityId),
      },
      include: {
        uploader: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(attachments);
  });

  // POST /api/attachments — upload d'un fichier
  app.post("/api/attachments", { preHandler: requireAuth }, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "Aucun fichier fourni" });
    }

    const entityType = (data.fields.entityType as any)?.value as AttachmentType;
    const entityId = parseInt((data.fields.entityId as any)?.value);

    if (!entityType || isNaN(entityId)) {
      return reply.status(400).send({ error: "entityType et entityId sont requis" });
    }

    const projectId = await getProjectIdForEntity(entityType, entityId);
    if (projectId) {
      const access = await getProjectAccess(req.currentUserId, projectId);
      if (!access) return reply.status(403).send({ error: "Accès refusé au projet" });
    }

    try {
      const storedPath = await storageService.saveFile(data.file, data.filename);
      
      const attachment = await db.attachment.create({
        data: {
          entityType,
          entityId,
          uploadedBy: req.currentUserId,
          filename: data.filename,
          storedPath,
          mimeType: data.mimetype,
          sizeBytes: 0,
        },
      });

      return reply.status(201).send(attachment);
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({ error: err.message || "Erreur lors de la sauvegarde du fichier" });
    }
  });

  // GET /api/attachments/:id/download — télécharger un fichier
  app.get("/api/attachments/:id/download", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attachment = await db.attachment.findUnique({ where: { id: parseInt(id) } });

    if (!attachment) {
      return reply.status(404).send({ error: "Fichier introuvable" });
    }

    // Vérification accès projet
    const projectId = await getProjectIdForEntity(attachment.entityType, attachment.entityId);
    if (projectId) {
      const access = await getProjectAccess(req.currentUserId, projectId);
      if (!access) return reply.status(403).send({ error: "Accès refusé" });
    }

    return reply.sendFile(attachment.storedPath, storageService.getAbsolutePath(""));
  });

  // DELETE /api/attachments/:id — supprimer un fichier
  app.delete("/api/attachments/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attachment = await db.attachment.findUnique({ where: { id: parseInt(id) } });

    if (!attachment) {
      return reply.status(404).send({ error: "Fichier introuvable" });
    }

    // Protection IDOR : seul l'uploadeur peut supprimer
    if (attachment.uploadedBy !== req.currentUserId) {
      return reply.status(403).send({ error: "Vous n'avez pas l'autorisation de supprimer ce fichier" });
    }

    await storageService.deleteFile(attachment.storedPath);
    await db.attachment.delete({ where: { id: parseInt(id) } });

    return reply.send({ ok: true });
  });
}
