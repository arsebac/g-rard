import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { logActivity } from "../services/activity";

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(["actif", "archivé"]).optional(),
});

export default async function projectRoutes(app: FastifyInstance) {
  app.get("/api/projects", { preHandler: requireAuth }, async (req, reply) => {
    const projects = await db.project.findMany({
      where: { status: "actif" },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(projects);
  });

  app.post("/api/projects", { preHandler: requireAuth }, async (req, reply) => {
    const body = createProjectSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const project = await db.project.create({
      data: { ...body.data, createdBy: req.currentUserId },
    });

    await logActivity({
      entityType: "project",
      entityId: project.id,
      actorId: req.currentUserId,
      action: "project_created",
      newValue: { name: project.name },
    });

    return reply.status(201).send(project);
  });

  app.get("/api/projects/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await db.project.findUnique({
      where: { id: parseInt(id) },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        labels: true,
        _count: { select: { tasks: true } },
      },
    });
    if (!project) return reply.status(404).send({ error: "Projet introuvable" });
    return reply.send(project);
  });

  app.patch("/api/projects/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateProjectSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const project = await db.project.update({
      where: { id: parseInt(id) },
      data: body.data as Parameters<typeof db.project.update>[0]["data"],
    });

    await logActivity({
      entityType: "project",
      entityId: project.id,
      actorId: req.currentUserId,
      action: "project_updated",
      newValue: body.data,
    });

    return reply.send(project);
  });

  app.delete("/api/projects/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.project.update({
      where: { id: parseInt(id) },
      data: { status: "archivé" },
    });
    return reply.send({ ok: true });
  });

  app.get("/api/projects/:id/activity", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit ?? "50"), 100);
    const offset = parseInt(query.offset ?? "0");

    const logs = await db.activityLog.findMany({
      where: { entityType: "project", entityId: parseInt(id) },
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
    return reply.send(logs);
  });
}
