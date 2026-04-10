import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireProjectMember, getProjectAccess } from "../plugins/auth";

// Types par défaut créés automatiquement pour chaque nouveau projet
const DEFAULT_TYPES = [
  { name: "Epic",  icon: "layers",       color: "#8b5cf6", isEpic: true,  position: 0 },
  { name: "Story", icon: "bookmark",     color: "#22c55e", isEpic: false, position: 1 },
  { name: "Task",  icon: "check-square", color: "#6366f1", isEpic: false, position: 2 },
  { name: "Bug",   icon: "bug",          color: "#ef4444", isEpic: false, position: 3 },
];

async function ensureDefaults(projectId: number) {
  const count = await db.ticketType.count({ where: { projectId } });
  if (count === 0) {
    await db.ticketType.createMany({
      data: DEFAULT_TYPES.map((t) => ({ ...t, projectId })),
    });
  }
}

const typeSchema = z.object({
  name:     z.string().min(1).max(100),
  icon:     z.string().default("square"),
  color:    z.string().default("#6366f1"),
  isEpic:   z.boolean().default(false),
  position: z.number().default(0),
});

export default async function ticketTypeRoutes(app: FastifyInstance) {
  // GET /api/projects/:id/ticket-types
  app.get("/api/projects/:id/ticket-types", { preHandler: [requireAuth, requireProjectMember] }, async (req, reply) => {
    const projectId = parseInt((req.params as any).id);
    if (isNaN(projectId)) return reply.status(400).send({ error: "ID invalide" });

    await ensureDefaults(projectId);
    const types = await db.ticketType.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
    });
    return reply.send(types);
  });

  // POST /api/projects/:id/ticket-types
  app.post("/api/projects/:id/ticket-types", { preHandler: [requireAuth, requireProjectMember] }, async (req, reply) => {
    const projectId = parseInt((req.params as any).id);
    if (isNaN(projectId)) return reply.status(400).send({ error: "ID invalide" });

    const body = typeSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Données invalides" });

    const type = await db.ticketType.create({
      data: { ...body.data, projectId },
    });
    return reply.status(201).send(type);
  });

  // PATCH /api/ticket-types/:id
  app.patch("/api/ticket-types/:id", { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    if (isNaN(id)) return reply.status(400).send({ error: "ID invalide" });

    const existing = await db.ticketType.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Type introuvable" });

    const access = await getProjectAccess(req.currentUserId, existing.projectId);
    if (!access) return reply.status(403).send({ error: "Accès refusé" });

    const body = typeSchema.partial().safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Données invalides" });

    const type = await db.ticketType.update({ where: { id }, data: body.data });
    return reply.send(type);
  });

  // DELETE /api/ticket-types/:id
  app.delete("/api/ticket-types/:id", { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    if (isNaN(id)) return reply.status(400).send({ error: "ID invalide" });

    const existing = await db.ticketType.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Type introuvable" });

    const access = await getProjectAccess(req.currentUserId, existing.projectId);
    if (!access) return reply.status(403).send({ error: "Accès refusé" });

    // Détacher les tâches avant suppression
    await db.task.updateMany({ where: { typeId: id }, data: { typeId: null } });
    await db.ticketType.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  // PATCH /api/projects/:id/ticket-types/reorder
  app.patch("/api/projects/:id/ticket-types/reorder", { preHandler: [requireAuth, requireProjectMember] }, async (req, reply) => {
    const projectId = parseInt((req.params as any).id);
    if (isNaN(projectId)) return reply.status(400).send({ error: "ID invalide" });

    const { order } = req.body as { order: number[] };
    if (!Array.isArray(order)) return reply.status(400).send({ error: "Données invalides" });

    await Promise.all(
      order.map((typeId, position) =>
        db.ticketType.update({ where: { id: typeId, projectId }, data: { position } })
      )
    );
    return reply.send({ ok: true });
  });
}
