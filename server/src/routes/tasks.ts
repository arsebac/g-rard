import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireProjectMember, getProjectAccess } from "../plugins/auth";
import { logActivity } from "../services/activity";
import { nextTaskNumber } from "../services/projectKey";
import { sanitizeHtml } from "../services/sanitize";
import { TaskStatus } from "@prisma/client";

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["a_faire", "en_cours", "termine", "bloque"]).default("a_faire"),
  priority: z.enum(["basse", "normale", "haute", "urgente"]).default("normale"),
  assigneeId: z.number().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  position: z.number().default(0),
  typeId: z.number().optional().nullable(),
  parentId: z.number().optional().nullable(),
});

const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  creator: { select: { id: true, name: true, avatarUrl: true } },
  labels: { include: { label: true } },
  type: true,
  parent: { select: { id: true, number: true, title: true, project: { select: { key: true } } } },
  _count: { select: { comments: true } },
} as const;

const updateTaskSchema = createTaskSchema.partial();

const moveTaskSchema = z.object({
  status: z.enum(["a_faire", "en_cours", "termine", "bloque"]),
  position: z.number(),
});

async function validateTransition(projectId: number, fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return true;

  const transitions = await db.workflowTransition.findMany({
    where: { projectId },
  });

  // Si aucune transition définie, tout est autorisé
  if (transitions.length === 0) return true;

  return transitions.some((t) => t.fromStatus === fromStatus && t.toStatus === toStatus);
}

export default async function taskRoutes(app: FastifyInstance) {
  app.get("/api/projects/:projectId/tasks", { preHandler: [requireAuth, requireProjectMember] }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const query = req.query as {
      status?: string;
      assigneeId?: string;
      labelId?: string;
      typeId?: string;
      dueDateFrom?: string;
      dueDateTo?: string;
    };

    const project = await db.project.findUnique({ where: { id: parseInt(projectId) }, select: { key: true } });
    const tasks = await db.task.findMany({
      where: {
        projectId: parseInt(projectId),
        ...(query.status && { status: query.status as TaskStatus }),
        ...(query.assigneeId && { assigneeId: parseInt(query.assigneeId) }),
        ...(query.labelId && {
          labels: { some: { labelId: parseInt(query.labelId) } },
        }),
        ...(query.typeId && { typeId: parseInt(query.typeId) }),
        ...((query.dueDateFrom || query.dueDateTo) && {
          dueDate: {
            ...(query.dueDateFrom && { gte: new Date(query.dueDateFrom) }),
            ...(query.dueDateTo && { lte: new Date(query.dueDateTo) }),
          },
        }),
      },
      include: TASK_INCLUDE,
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });
    // Injecter la clé du projet dans chaque tâche
    const projectKey = project?.key ?? null;
    return reply.send(tasks.map((t) => ({ ...t, projectKey })));
  });

  app.post("/api/projects/:projectId/tasks", { preHandler: [requireAuth, requireProjectMember] }, async (req, reply) => {
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

    const { dueDate, title, description, ...rest } = body.data;
    const number = await nextTaskNumber(parseInt(projectId));
    const task = await db.task.create({
      data: {
        ...rest,
        title: sanitizeHtml(title),
        description: description ? sanitizeHtml(description) : null,
        status: rest.status as TaskStatus,
        projectId: parseInt(projectId),
        createdBy: req.currentUserId,
        position,
        number,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: TASK_INCLUDE,
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

  // Lookup par référence projet (ex: CUI-5)
  app.get("/api/tasks/ref/:key/:number", { preHandler: requireAuth }, async (req, reply) => {
    const { key, number } = req.params as { key: string; number: string };
    const project = await db.project.findFirst({ where: { key: key.toUpperCase() } });
    if (!project) return reply.status(404).send({ error: "Projet introuvable" });

    // Vérification accès projet
    const access = await getProjectAccess(req.currentUserId, project.id);
    if (!access) return reply.status(403).send({ error: "Accès refusé" });

    const task = await db.task.findFirst({
      where: { projectId: project.id, number: parseInt(number) },
      include: {
        ...TASK_INCLUDE,
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!task) return reply.status(404).send({ error: "Tâche introuvable" });
    return reply.send({ ...task, projectKey: project.key });
  });

  app.get("/api/tasks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = await db.task.findUnique({
      where: { id: parseInt(id) },
      include: {
        ...TASK_INCLUDE,
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!task) return reply.status(404).send({ error: "Tâche introuvable" });

    // Vérification accès projet
    const access = await getProjectAccess(req.currentUserId, task.projectId);
    if (!access) return reply.status(403).send({ error: "Accès refusé" });

    return reply.send(task);
  });

  app.patch("/api/tasks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    
    const old = await db.task.findUnique({ where: { id: parseInt(id) } });
    if (!old) return reply.status(404).send({ error: "Tâche introuvable" });

    // Vérification accès projet
    const access = await getProjectAccess(req.currentUserId, old.projectId);
    if (!access) return reply.status(403).send({ error: "Accès refusé" });

    const body = updateTaskSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const { dueDate, title, description, ...rest } = body.data;

    // Validation du workflow si le statut change
    if (rest.status && rest.status !== old.status) {
      const allowed = await validateTransition(old.projectId, old.status, rest.status);
      if (!allowed) {
        return reply.status(400).send({ error: `Transition non autorisée de ${old.status} vers ${rest.status}` });
      }
    }

    const task = await db.task.update({
      where: { id: parseInt(id) },
      data: {
        ...rest,
        ...(title !== undefined && { title: sanitizeHtml(title) }),
        ...(description !== undefined && { description: description ? sanitizeHtml(description) : null }),
        ...(rest.status && { status: rest.status as TaskStatus }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
      include: TASK_INCLUDE,
    });

    const logs: Promise<void>[] = [];

    if (old?.title !== task.title) {
      logs.push(logActivity({ entityType: "task", entityId: task.id, actorId: req.currentUserId, action: "title_changed", oldValue: { title: old?.title }, newValue: { title: task.title } }));
    }
    if (old?.status !== task.status) {
      logs.push(logActivity({ entityType: "task", entityId: task.id, actorId: req.currentUserId, action: "status_changed", oldValue: { status: old?.status }, newValue: { status: task.status } }));
    }
    if (old?.priority !== task.priority) {
      logs.push(logActivity({ entityType: "task", entityId: task.id, actorId: req.currentUserId, action: "priority_changed", oldValue: { priority: old?.priority }, newValue: { priority: task.priority } }));
    }
    if (old?.assigneeId !== task.assigneeId) {
      logs.push(logActivity({ entityType: "task", entityId: task.id, actorId: req.currentUserId, action: "assignee_changed", oldValue: { assigneeId: old?.assigneeId }, newValue: { assigneeId: task.assigneeId } }));
    }
    if (old?.dueDate?.toISOString() !== task.dueDate?.toISOString()) {
      logs.push(logActivity({ entityType: "task", entityId: task.id, actorId: req.currentUserId, action: "due_date_changed", oldValue: { dueDate: old?.dueDate }, newValue: { dueDate: task.dueDate } }));
    }
    if (old?.description !== task.description) {
      logs.push(logActivity({ entityType: "task", entityId: task.id, actorId: req.currentUserId, action: "description_changed", newValue: {} }));
    }
    if (old?.typeId !== task.typeId) {
      logs.push(logActivity({ entityType: "task", entityId: task.id, actorId: req.currentUserId, action: "type_changed", oldValue: { typeId: old?.typeId }, newValue: { typeId: task.typeId } }));
    }
    if (old?.parentId !== task.parentId) {
      logs.push(logActivity({ entityType: "task", entityId: task.id, actorId: req.currentUserId, action: "parent_changed", oldValue: { parentId: old?.parentId }, newValue: { parentId: task.parentId } }));
    }

    await Promise.all(logs);
    return reply.send(task);
  });

  app.patch("/api/tasks/:id/move", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const old = await db.task.findUnique({ where: { id: parseInt(id) } });
    if (!old) return reply.status(404).send({ error: "Tâche introuvable" });

    // Vérification accès projet
    const access = await getProjectAccess(req.currentUserId, old.projectId);
    if (!access) return reply.status(403).send({ error: "Accès refusé" });

    const body = moveTaskSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides" });
    }

    // Validation du workflow si le statut change
    if (body.data.status !== old.status) {
      const allowed = await validateTransition(old.projectId, old.status, body.data.status);
      if (!allowed) {
        return reply.status(400).send({ error: `Transition non autorisée de ${old.status} vers ${body.data.status}` });
      }
    }

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
    const taskToDelete = await db.task.findUnique({ where: { id: parseInt(id) } });
    if (!taskToDelete) return reply.status(404).send({ error: "Tâche introuvable" });

    // Vérification accès projet
    const access = await getProjectAccess(req.currentUserId, taskToDelete.projectId);
    if (!access) return reply.status(403).send({ error: "Accès refusé" });

    await db.task.delete({ where: { id: parseInt(id) } });
    return reply.send({ ok: true });
  });
}
