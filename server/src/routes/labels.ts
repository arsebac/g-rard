import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireProjectViewer, requireProjectMember, ensureProjectAccess, ensureTaskAccess } from "../plugins/auth";

const labelSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export default async function labelRoutes(app: FastifyInstance) {
  // ─── Labels du projet ──────────────────────────────────────────────────────

  app.get("/api/projects/:id/labels", { preHandler: [requireAuth, requireProjectViewer] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const labels = await db.label.findMany({
      where: { projectId: parseInt(id) },
      orderBy: { name: "asc" },
    });
    return reply.send(labels);
  });

  app.post("/api/projects/:id/labels", { preHandler: [requireAuth, requireProjectMember] }, async (req, reply) => {
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
    const existing = await db.label.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return reply.status(404).send({ error: "Label not found" });
    if (!(await ensureProjectAccess(req, reply, existing.projectId, "write"))) return reply;
    const label = await db.label.update({
      where: { id: parseInt(id) },
      data: body.data,
    });
    return reply.send(label);
  });

  app.delete("/api/labels/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await db.label.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return reply.status(404).send({ error: "Label not found" });
    if (!(await ensureProjectAccess(req, reply, existing.projectId, "write"))) return reply;
    await db.label.delete({ where: { id: parseInt(id) } });
    return reply.send({ ok: true });
  });

  // ─── Assignation de labels sur tâches ──────────────────────────────────────

  app.post("/api/tasks/:id/labels/:labelId", { preHandler: requireAuth }, async (req, reply) => {
    const { id, labelId } = req.params as { id: string; labelId: string };
    const task = await ensureTaskAccess(req, reply, parseInt(id), "write");
    if (!task) return reply;
    const label = await db.label.findUnique({ where: { id: parseInt(labelId) } });
    if (!label) return reply.status(404).send({ error: "Label not found" });
    if (label.projectId !== task.projectId) {
      return reply.status(400).send({ error: "Label belongs to another project" });
    }
    await db.taskLabel.upsert({
      where: { taskId_labelId: { taskId: parseInt(id), labelId: parseInt(labelId) } },
      create: { taskId: parseInt(id), labelId: parseInt(labelId) },
      update: {},
    });
    return reply.status(201).send({ ok: true });
  });

  app.delete("/api/tasks/:id/labels/:labelId", { preHandler: requireAuth }, async (req, reply) => {
    const { id, labelId } = req.params as { id: string; labelId: string };
    if (!(await ensureTaskAccess(req, reply, parseInt(id), "write"))) return reply;
    await db.taskLabel.deleteMany({
      where: { taskId: parseInt(id), labelId: parseInt(labelId) },
    });
    return reply.send({ ok: true });
  });
}
