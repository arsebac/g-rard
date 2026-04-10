import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";

const STATUSES = ["a_faire", "en_cours", "termine", "bloque"] as const;

const saveSchema = z.object({
  // Array of { fromStatus, toStatus } — remplace toutes les transitions du projet
  transitions: z.array(
    z.object({
      fromStatus: z.enum(STATUSES),
      toStatus:   z.enum(STATUSES),
    })
  ),
});

export default async function workflowRoutes(app: FastifyInstance) {
  // GET /api/projects/:id/workflow
  // Retourne les transitions autorisées. Si vide → toutes autorisées.
  app.get("/api/projects/:id/workflow", { preHandler: requireAuth }, async (req, reply) => {
    const projectId = parseInt((req.params as any).id);
    const transitions = await db.workflowTransition.findMany({
      where: { projectId },
    });
    return reply.send(transitions);
  });

  // PUT /api/projects/:id/workflow  (remplace toutes les transitions)
  app.put("/api/projects/:id/workflow", { preHandler: requireAuth }, async (req, reply) => {
    const projectId = parseInt((req.params as any).id);
    const body = saveSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Données invalides" });

    // Supprimer puis recréer (upsert en masse)
    await db.workflowTransition.deleteMany({ where: { projectId } });

    if (body.data.transitions.length > 0) {
      await db.workflowTransition.createMany({
        data: body.data.transitions
          .filter((t) => t.fromStatus !== t.toStatus)
          .map((t) => ({ projectId, fromStatus: t.fromStatus, toStatus: t.toStatus })),
      });
    }

    const saved = await db.workflowTransition.findMany({ where: { projectId } });
    return reply.send(saved);
  });
}
