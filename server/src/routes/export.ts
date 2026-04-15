import { FastifyInstance } from "fastify";
import { db } from "../db";
import { requireAuth, requireProjectMember } from "../plugins/auth";
import { Readable } from "stream";

/**
 * Escapes a value for CSV.
 * Also protects against CSV Injection by escaping leading formula characters.
 */
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  
  // Security: Prevent CSV Injection (Formula Injection)
  // If the cell starts with =, +, -, or @, prepend a single quote
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatRow(cells: unknown[]): string {
  return cells.map(escapeCsv).join(",") + "\n";
}

const STATUS_LABELS: Record<string, string> = {
  a_faire: "To Do",
  en_cours: "In Progress",
  termine: "Done",
  bloque: "Blocked",
};

const PRIORITY_LABELS: Record<string, string> = {
  basse: "Low",
  normale: "Normal",
  haute: "High",
  urgente: "Urgent",
};

export default async function exportRoutes(app: FastifyInstance) {
  app.get("/api/projects/:id/export/csv", { preHandler: [requireAuth, requireProjectMember] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const projectId = parseInt(id);
    if (isNaN(projectId)) return reply.status(400).send({ error: "Invalid project ID" });

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true, key: true },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const tasks = await db.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { name: true } },
        creator: { select: { name: true } },
        labels: { include: { label: { select: { name: true } } } },
      },
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });

    const filename = `${project.key ?? project.name}_export.csv`;

    // Set headers for download and UTF-8 with BOM for Excel
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`);

    // Stream the CSV content
    const csvStream = new Readable({
      read() {}
    });

    // Send the UTF-8 BOM first
    csvStream.push("\uFEFF");

    // Header row
    csvStream.push(formatRow([
      "Reference", "Title", "Status", "Priority", "Assignee", 
      "Labels", "Due Date", "Created By", "Created At", "Updated At"
    ]));

    // Data rows
    for (const t of tasks) {
      csvStream.push(formatRow([
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
      ]));
    }

    // End the stream
    csvStream.push(null);

    return reply.send(csvStream);
  });
}
