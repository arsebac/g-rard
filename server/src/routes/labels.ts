import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";

const labelSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export default async function labelRoutes(app: FastifyInstance) {
  // ─── Labels du projet ──────────────────────────────────────────────────────

  app.get("/api/projects/:id/labels", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const labels = await db.label.findMany({
      where: { projectId: parseInt(id) },
      orderBy: { name: "asc" },
    });
    return reply.send(labels);
  });

  app.post("/api/projects/:id/labels", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = labelSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }
    const label = await db.label.create({
      data: { ...body.data, projectId: parseInt(id) },
    });
    return reply.status(201).send(label);
  });

  app.patch("/api/labels/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = labelSchema.partial().safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides" });
    }
    const label = await db.label.update({
      where: { id: parseInt(id) },
      data: body.data,
    });
    return reply.send(label);
  });

  app.delete("/api/labels/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.label.delete({ where: { id: parseInt(id) } });
    return reply.send({ ok: true });
  });

  // ─── Assignation de labels sur tâches ──────────────────────────────────────

  app.post("/api/tasks/:id/labels/:labelId", { preHandler: requireAuth }, async (req, reply) => {
    const { id, labelId } = req.params as { id: string; labelId: string };
    await db.taskLabel.upsert({
      where: { taskId_labelId: { taskId: parseInt(id), labelId: parseInt(labelId) } },
      create: { taskId: parseInt(id), labelId: parseInt(labelId) },
      update: {},
    });
    return reply.status(201).send({ ok: true });
  });

  app.delete("/api/tasks/:id/labels/:labelId", { preHandler: requireAuth }, async (req, reply) => {
    const { id, labelId } = req.params as { id: string; labelId: string };
    await db.taskLabel.deleteMany({
      where: { taskId: parseInt(id), labelId: parseInt(labelId) },
    });
    return reply.send({ ok: true });
  });
}
