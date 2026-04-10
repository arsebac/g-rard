import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireProjectMember } from "../plugins/auth";

const sprintSchema = z.object({
  name: z.string().min(1).max(255),
  goal: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.enum(["futur", "actif", "termine"]).default("futur"),
});

const updateSprintSchema = sprintSchema.partial();

export default async function sprintRoutes(app: FastifyInstance) {
  // Liste des sprints d'un projet
  app.get("/api/projects/:projectId/sprints", { preHandler: [requireAuth, requireProjectMember] }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const sprints = await db.sprint.findMany({
      where: { projectId: parseInt(projectId) },
      include: {
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(sprints);
  });

  // Créer un sprint
  app.post("/api/projects/:projectId/sprints", { preHandler: [requireAuth, requireProjectMember] }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = sprintSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const sprint = await db.sprint.create({
      data: {
        ...body.data,
        projectId: parseInt(projectId),
        startDate: body.data.startDate ? new Date(body.data.startDate) : null,
        endDate: body.data.endDate ? new Date(body.data.endDate) : null,
      },
    });

    return reply.status(201).send(sprint);
  });

  // Modifier un sprint
  app.patch("/api/sprints/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateSprintSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const oldSprint = await db.sprint.findUnique({ where: { id: parseInt(id) } });
    if (!oldSprint) return reply.status(404).send({ error: "Sprint introuvable" });

    const sprint = await db.sprint.update({
      where: { id: parseInt(id) },
      data: {
        ...body.data,
        startDate: body.data.startDate !== undefined ? (body.data.startDate ? new Date(body.data.startDate) : null) : undefined,
        endDate: body.data.endDate !== undefined ? (body.data.endDate ? new Date(body.data.endDate) : null) : undefined,
      },
    });

    return reply.send(sprint);
  });

  // Supprimer un sprint
  app.delete("/api/sprints/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sprint = await db.sprint.findUnique({ where: { id: parseInt(id) } });
    if (!sprint) return reply.status(404).send({ error: "Sprint introuvable" });

    // Détacher les tâches avant suppression (Prisma SetNull le fera via le schéma, mais on s'assure)
    await db.sprint.delete({ where: { id: parseInt(id) } });
    return reply.send({ ok: true });
  });
}
