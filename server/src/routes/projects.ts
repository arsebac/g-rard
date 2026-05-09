import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireProjectViewer, requireProjectMember, requireProjectAdmin } from "../plugins/auth";
import { logActivity } from "../services/activity";
import { generateUniqueKey } from "../services/projectKey";
import { ensureDefaultColumns } from "./projectColumns";

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  key: z.string().min(1).max(5).regex(/^[A-Z0-9]+$/).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  isPublic: z.boolean().default(true),
});

const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(["actif", "archive"]).optional(),
});

export default async function projectRoutes(app: FastifyInstance) {
  app.get("/api/projects", { preHandler: requireAuth }, async (req, reply) => {
    const projects = await db.project.findMany({
      where: {
        status: "actif",
        members: { some: { userId: req.currentUserId } },
      },
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
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
    }

    const key = body.data.key ?? await generateUniqueKey(body.data.name);
    const project = await db.project.create({
      data: { 
        ...body.data, 
        key, 
        createdBy: req.currentUserId,
        members: {
          create: { userId: req.currentUserId, role: "admin" }
        }
      },
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

  app.get("/api/projects/by-key/:key", { preHandler: requireAuth }, async (req, reply) => {
    const { key } = req.params as { key: string };

    const projectBase = await db.project.findFirst({
      where: {
        key: key.toUpperCase(),
        members: { some: { userId: req.currentUserId } },
      },
      select: { id: true },
    });

    if (!projectBase) return reply.status(404).send({ error: "Project not found" });

    await ensureDefaultColumns(projectBase.id);

    const project = await db.project.findUnique({
      where: { id: projectBase.id },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        labels: true,
        columns: { orderBy: { position: "asc" } },
        workflowTransitions: true,
        _count: { select: { tasks: true } },
      },
    });

    return reply.send(project);
  });

  app.get("/api/projects/:id", { preHandler: [requireAuth, requireProjectViewer] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const projectId = parseInt(id);
    await ensureDefaultColumns(projectId);
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        labels: true,
        columns: { orderBy: { position: "asc" } },
        workflowTransitions: true,
        _count: { select: { tasks: true } },
      },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    return reply.send(project);
  });

  app.patch("/api/projects/:id", { preHandler: [requireAuth, requireProjectAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateProjectSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
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

  app.delete("/api/projects/:id", { preHandler: [requireAuth, requireProjectAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { hard } = req.query as { hard?: string };

    if (hard === "true") {
      const projectId = parseInt(id);
      
      // Get all task and wiki page IDs for this project to clean up their activity logs and attachments
      const tasks = await db.task.findMany({
        where: { projectId },
        select: { id: true }
      });
      const taskIds = tasks.map(t => t.id);

      const wikiPages = await db.wikiPage.findMany({
        where: { projectId },
        select: { id: true }
      });
      const wikiPageIds = wikiPages.map(w => w.id);

      // Clean up activity logs
      await db.activityLog.deleteMany({
        where: {
          OR: [
            { entityType: "project", entityId: projectId },
            { entityType: "task", entityId: { in: taskIds } },
            { entityType: "wiki_page", entityId: { in: wikiPageIds } }
          ]
        }
      });

      // Clean up attachments
      await db.attachment.deleteMany({
        where: {
          OR: [
            { entityType: "project", entityId: projectId },
            { entityType: "task", entityId: { in: taskIds } },
            { entityType: "wiki_page", entityId: { in: wikiPageIds } }
          ]
        }
      });

      // Now delete the project (cascades will handle the rest: tasks, members, etc.)
      await db.project.delete({
        where: { id: projectId },
      });
      return reply.send({ ok: true, deleted: true });
    }

    await db.project.update({
      where: { id: parseInt(id) },
      data: { status: "archive" },
    });
    return reply.send({ ok: true, archived: true });
  });

  app.get("/api/projects/:id/members", { preHandler: [requireAuth, requireProjectViewer] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const members = await db.projectMember.findMany({
      where: { projectId: parseInt(id) },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return reply.send(members);
  });

  app.post("/api/projects/:id/members", { preHandler: [requireAuth, requireProjectAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const projectId = parseInt(id);
    const body = z.object({
      userId: z.number(),
      role: z.enum(["admin", "member", "viewer"]).default("member"),
    }).safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
    }

    const existing = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: body.data.userId } },
    });
    if (existing) {
      return reply.status(409).send({ error: "User is already a member of this project" });
    }

    const member = await db.projectMember.create({
      data: { projectId, userId: body.data.userId, role: body.data.role as any },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return reply.status(201).send(member);
  });

  app.patch("/api/projects/:id/members/:userId", { preHandler: [requireAuth, requireProjectAdmin] }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const projectId = parseInt(id);
    const targetUserId = parseInt(userId);

    const body = z.object({
      role: z.enum(["admin", "member", "viewer"]),
    }).safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
    }

    const existing = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!existing) return reply.status(404).send({ error: "Member not found" });

    // Prevent removing the last admin
    if (existing.role === "admin" && body.data.role !== "admin") {
      const adminCount = await db.projectMember.count({ where: { projectId, role: "admin" } });
      if (adminCount <= 1) {
        return reply.status(400).send({ error: "Cannot demote the last admin of this project" });
      }
    }

    const member = await db.projectMember.update({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      data: { role: body.data.role as any },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return reply.send(member);
  });

  app.delete("/api/projects/:id/members/:userId", { preHandler: [requireAuth, requireProjectAdmin] }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const projectId = parseInt(id);
    const targetUserId = parseInt(userId);

    const existing = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!existing) return reply.status(404).send({ error: "Member not found" });

    // Prevent removing the last admin
    if (existing.role === "admin") {
      const adminCount = await db.projectMember.count({ where: { projectId, role: "admin" } });
      if (adminCount <= 1) {
        return reply.status(400).send({ error: "Cannot remove the last admin of this project" });
      }
    }

    await db.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    return reply.send({ ok: true });
  });

  app.get("/api/projects/:id/activity", { preHandler: [requireAuth, requireProjectViewer] }, async (req, reply) => {
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
