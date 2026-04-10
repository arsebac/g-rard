import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";

const DEFAULT_COLUMNS = [
  { statusKey: "a_faire",  label: "À faire",   color: "#94a3b8", position: 0, visible: true },
  { statusKey: "en_cours", label: "En cours",   color: "#3b82f6", position: 1, visible: true },
  { statusKey: "bloque",   label: "Bloqué",     color: "#ef4444", position: 2, visible: true },
  { statusKey: "termine",  label: "Terminé",    color: "#22c55e", position: 3, visible: true },
];

export async function ensureDefaultColumns(projectId: number) {
  const count = await db.projectColumn.count({ where: { projectId } });
  if (count === 0) {
    await db.projectColumn.createMany({
      data: DEFAULT_COLUMNS.map((c) => ({ ...c, projectId })),
    });
  }
}

const columnUpdateSchema = z.object({
  label:    z.string().min(1).max(100).optional(),
  color:    z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  visible:  z.boolean().optional(),
  position: z.number().optional(),
});

const reorderSchema = z.object({
  order: z.array(z.string()), // statusKey[]
});

export default async function projectColumnRoutes(app: FastifyInstance) {
  // GET /api/projects/:id/columns
  app.get("/api/projects/:id/columns", { preHandler: requireAuth }, async (req, reply) => {
    const projectId = parseInt((req.params as any).id);
    await ensureDefaultColumns(projectId);
    const columns = await db.projectColumn.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
    });
    return reply.send(columns);
  });

  // PATCH /api/projects/:id/columns/:statusKey
  app.patch("/api/projects/:id/columns/:statusKey", { preHandler: requireAuth }, async (req, reply) => {
    const projectId = parseInt((req.params as any).id);
    const { statusKey } = req.params as { statusKey: string };
    const body = columnUpdateSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Données invalides" });

    const col = await db.projectColumn.update({
      where: { projectId_statusKey: { projectId, statusKey } },
      data: body.data,
    });
    return reply.send(col);
  });

  // PATCH /api/projects/:id/columns/reorder
  app.patch("/api/projects/:id/columns/reorder", { preHandler: requireAuth }, async (req, reply) => {
    const projectId = parseInt((req.params as any).id);
    const body = reorderSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Données invalides" });

    await Promise.all(
      body.data.order.map((statusKey, position) =>
        db.projectColumn.update({
          where: { projectId_statusKey: { projectId, statusKey } },
          data: { position },
        })
      )
    );
    return reply.send({ ok: true });
  });
}
