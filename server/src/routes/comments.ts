import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { logActivity } from "../services/activity";

const bodySchema = z.object({ body: z.string().min(1) });

export default async function commentRoutes(app: FastifyInstance) {
  app.get("/api/tasks/:taskId/comments", { preHandler: requireAuth }, async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const comments = await db.comment.findMany({
      where: { taskId: parseInt(taskId) },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    return reply.send(comments);
  });

  app.post("/api/tasks/:taskId/comments", { preHandler: requireAuth }, async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Données invalides" });

    const comment = await db.comment.create({
      data: { taskId: parseInt(taskId), authorId: req.currentUserId, body: parsed.data.body },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    await logActivity({
      entityType: "task",
      entityId: parseInt(taskId),
      actorId: req.currentUserId,
      action: "comment_added",
      newValue: { commentId: comment.id },
    });

    return reply.status(201).send(comment);
  });

  app.patch("/api/comments/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Données invalides" });

    const existing = await db.comment.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return reply.status(404).send({ error: "Commentaire introuvable" });
    if (existing.authorId !== req.currentUserId) return reply.status(403).send({ error: "Accès refusé" });

    const comment = await db.comment.update({
      where: { id: parseInt(id) },
      data: { body: parsed.data.body },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return reply.send(comment);
  });

  app.delete("/api/comments/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await db.comment.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return reply.status(404).send({ error: "Commentaire introuvable" });
    if (existing.authorId !== req.currentUserId) return reply.status(403).send({ error: "Accès refusé" });

    await db.comment.delete({ where: { id: parseInt(id) } });

    await logActivity({
      entityType: "task",
      entityId: existing.taskId,
      actorId: req.currentUserId,
      action: "comment_deleted",
    });

    return reply.send({ ok: true });
  });

  app.get("/api/tasks/:taskId/activity", { preHandler: requireAuth }, async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const logs = await db.activityLog.findMany({
      where: { entityType: "task", entityId: parseInt(taskId) },
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    return reply.send(logs);
  });
}
