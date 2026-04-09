import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { logActivity } from "../services/activity";
import { TaskStatus } from "@prisma/client";

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["a_faire", "en_cours", "termine", "bloque"]).default("a_faire"),
  priority: z.enum(["basse", "normale", "haute", "urgente"]).default("normale"),
  assigneeId: z.number().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  position: z.number().default(0),
});

const updateTaskSchema = createTaskSchema.partial();

const moveTaskSchema = z.object({
  status: z.enum(["a_faire", "en_cours", "termine", "bloque"]),
  position: z.number(),
});

export default async function taskRoutes(app: FastifyInstance) {
  app.get("/api/projects/:projectId/tasks", { preHandler: requireAuth }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const query = req.query as { status?: string; assigneeId?: string; labelId?: string };

    const tasks = await db.task.findMany({
      where: {
        projectId: parseInt(projectId),
        ...(query.status && { status: query.status as TaskStatus }),
        ...(query.assigneeId && { assigneeId: parseInt(query.assigneeId) }),
        ...(query.labelId && {
          labels: { some: { labelId: parseInt(query.labelId) } },
        }),
      },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        labels: { include: { label: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });
    return reply.send(tasks);
  });

  app.post("/api/projects/:projectId/tasks", { preHandler: requireAuth }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = createTaskSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    // Position en fin de colonne
    const lastTask = await db.task.findFirst({
      where: { projectId: parseInt(projectId), status: body.data.status as TaskStatus },
      orderBy: { position: "desc" },
    });
    const position = (lastTask?.position ?? 0) + 1000;

    const { dueDate, ...rest } = body.data;
    const task = await db.task.create({
      data: {
        ...rest,
        status: rest.status as TaskStatus,
        projectId: parseInt(projectId),
        createdBy: req.currentUserId,
        position,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        labels: { include: { label: true } },
      },
    });

    await logActivity({
      entityType: "task",
      entityId: task.id,
      actorId: req.currentUserId,
      action: "task_created",
      newValue: { title: task.title },
    });

    return reply.status(201).send(task);
  });

  app.get("/api/tasks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = await db.task.findUnique({
      where: { id: parseInt(id) },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        labels: { include: { label: true } },
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!task) return reply.status(404).send({ error: "Tâche introuvable" });
    return reply.send(task);
  });

  app.patch("/api/tasks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateTaskSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const old = await db.task.findUnique({ where: { id: parseInt(id) } });
    const { dueDate, ...rest } = body.data;

    const task = await db.task.update({
      where: { id: parseInt(id) },
      data: {
        ...rest,
        ...(rest.status && { status: rest.status as TaskStatus }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        labels: { include: { label: true } },
      },
    });

    if (old?.status !== task.status) {
      await logActivity({
        entityType: "task",
        entityId: task.id,
        actorId: req.currentUserId,
        action: "status_changed",
        oldValue: { status: old?.status },
        newValue: { status: task.status },
      });
    }

    return reply.send(task);
  });

  app.patch("/api/tasks/:id/move", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = moveTaskSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides" });
    }

    const old = await db.task.findUnique({ where: { id: parseInt(id) } });
    const task = await db.task.update({
      where: { id: parseInt(id) },
      data: { status: body.data.status as TaskStatus, position: body.data.position },
    });

    if (old?.status !== task.status) {
      await logActivity({
        entityType: "task",
        entityId: task.id,
        actorId: req.currentUserId,
        action: "status_changed",
        oldValue: { status: old?.status },
        newValue: { status: task.status },
      });
    }

    return reply.send(task);
  });

  app.delete("/api/tasks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.task.delete({ where: { id: parseInt(id) } });
    return reply.send({ ok: true });
  });
}
