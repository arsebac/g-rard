import { FastifyInstance } from "fastify";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { storageService } from "../services/storage";
import { AttachmentType } from "@prisma/client";

export default async function attachmentRoutes(app: FastifyInstance) {
  // GET /api/attachments — liste des pièces jointes pour une entité
  app.get("/api/attachments", { preHandler: requireAuth }, async (req, reply) => {
    const { entityType, entityId } = req.query as { entityType: AttachmentType; entityId: string };
    if (!entityType || !entityId) {
      return reply.status(400).send({ error: "entityType et entityId sont requis" });
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

    // On récupère les champs supplémentaires (entityType, entityId)
    // Note: ils doivent être envoyés AVANT le fichier dans le FormData si on veut les avoir ici direct via data.fields
    // Sinon on peut utiliser req.parts()
    const entityType = (data.fields.entityType as any)?.value as AttachmentType;
    const entityId = parseInt((data.fields.entityId as any)?.value);

    if (!entityType || isNaN(entityId)) {
      return reply.status(400).send({ error: "entityType et entityId sont requis" });
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
          sizeBytes: 0, // Idéalement on récupère la taille après stream, ou on stream vers un buffer temporaire
        },
      });

      return reply.status(201).send(attachment);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Erreur lors de la sauvegarde du fichier" });
    }
  });

  // GET /api/attachments/:id/download — télécharger un fichier
  app.get("/api/attachments/:id/download", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attachment = await db.attachment.findUnique({ where: { id: parseInt(id) } });

    if (!attachment) {
      return reply.status(404).send({ error: "Fichier introuvable" });
    }

    const absolutePath = storageService.getAbsolutePath(attachment.storedPath);
    return reply.sendFile(attachment.storedPath, storageService.getAbsolutePath(""));
  });

  // DELETE /api/attachments/:id — supprimer un fichier
  app.delete("/api/attachments/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attachment = await db.attachment.findUnique({ where: { id: parseInt(id) } });

    if (!attachment) {
      return reply.status(404).send({ error: "Fichier introuvable" });
    }

    await storageService.deleteFile(attachment.storedPath);
    await db.attachment.delete({ where: { id: parseInt(id) } });

    return reply.send({ ok: true });
  });
}
