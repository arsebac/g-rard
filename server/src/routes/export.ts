import { FastifyInstance } from "fastify";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(cells: unknown[]): string {
  return cells.map(escapeCsv).join(",");
}

const STATUS_LABELS: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
  bloque: "Bloqué",
};

const PRIORITY_LABELS: Record<string, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  urgente: "Urgente",
};

export default async function exportRoutes(app: FastifyInstance) {
  app.get("/api/projects/:id/export/csv", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const project = await db.project.findUnique({
      where: { id: parseInt(id) },
      select: { name: true, key: true },
    });
    if (!project) return reply.status(404).send({ error: "Projet introuvable" });

    const tasks = await db.task.findMany({
      where: { projectId: parseInt(id) },
      include: {
        assignee: { select: { name: true } },
        creator: { select: { name: true } },
        labels: { include: { label: { select: { name: true } } } },
      },
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });

    const header = row(["Référence", "Titre", "Statut", "Priorité", "Assignée", "Labels", "Date échéance", "Créée par", "Créée le", "Mise à jour"]);

    const lines = tasks.map((t) =>
      row([
        `${project.key}-${t.number}`,
        t.title,
        STATUS_LABELS[t.status] ?? t.status,
        PRIORITY_LABELS[t.priority] ?? t.priority,
        t.assignee?.name ?? "",
        t.labels.map((l) => l.label.name).join("; "),
        t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "",
        t.creator?.name ?? "",
        t.createdAt.toISOString().slice(0, 10),
        t.updatedAt.toISOString().slice(0, 10),
      ])
    );

    const csv = [header, ...lines].join("\n");
    const filename = `${project.key ?? project.name}_export.csv`;

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send("\uFEFF" + csv); // BOM UTF-8 pour Excel
  });
}
