import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { TaskLinkType } from "@prisma/client";

const LINK_TYPES = [
  "blocks", "is_blocked_by", "relates_to",
  "duplicates", "is_duplicated_by",
  "causes", "is_caused_by",
] as const;

const createLinkSchema = z.object({
  targetId: z.number(),
  linkType: z.enum(LINK_TYPES),
});

// Clé de project pour enrichir les tâches liées
async function enrichTask(taskId: number) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { key: true } },
      type: true,
    },
  });
  if (!task) return null;
  return { ...task, projectKey: task.project.key };
}

export default async function taskLinkRoutes(app: FastifyInstance) {
  // GET /api/tasks/:id/links
  app.get("/api/tasks/:id/links", { preHandler: requireAuth }, async (req, reply) => {
    const taskId = parseInt((req.params as any).id);

    const [from, to] = await Promise.all([
      db.taskLink.findMany({
        where: { sourceId: taskId },
        include: { target: { include: { project: { select: { key: true } }, type: true } } },
      }),
      db.taskLink.findMany({
        where: { targetId: taskId },
        include: { source: { include: { project: { select: { key: true } }, type: true } } },
      }),
    ]);

    // Normaliser : toujours { id, linkType, task }
    const links = [
      ...from.map((l) => ({
        id: l.id,
        linkType: l.linkType,
        direction: "outbound" as const,
        task: { ...l.target, projectKey: l.target.project.key },
      })),
      ...to.map((l) => ({
        id: l.id,
        linkType: l.linkType,
        direction: "inbound" as const,
        task: { ...l.source, projectKey: l.source.project.key },
      })),
    ];

    return reply.send(links);
  });

  // POST /api/tasks/:id/links
  app.post("/api/tasks/:id/links", { preHandler: requireAuth }, async (req, reply) => {
    const sourceId = parseInt((req.params as any).id);
    const body = createLinkSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Données invalides" });

    // Éviter auto-lien
    if (body.data.targetId === sourceId)
      return reply.status(400).send({ error: "Impossible de lier un ticket à lui-même" });

    const link = await db.taskLink.create({
      data: {
        sourceId,
        targetId: body.data.targetId,
        linkType: body.data.linkType as TaskLinkType,
        createdBy: req.currentUserId,
      },
    });
    return reply.status(201).send(link);
  });

  // DELETE /api/task-links/:id
  app.delete("/api/task-links/:id", { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    await db.taskLink.delete({ where: { id } });
    return reply.send({ ok: true });
  });
}
