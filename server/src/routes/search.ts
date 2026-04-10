import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";

type SearchResult = {
  id: number;
  project_id: number;
  number: number;
  title: string;
  status: string;
  priority: string;
  project_key: string | null;
  project_name: string;
  project_color: string;
};

export default async function searchRoutes(app: FastifyInstance) {
  app.get("/api/search", { preHandler: requireAuth }, async (req, reply) => {
    const query = req.query as { q?: string; projectId?: string };
    const q = query.q?.trim();

    if (!q || q.length < 2) {
      return reply.send([]);
    }

    const projectId = query.projectId ? parseInt(query.projectId) : undefined;

    const mapResults = (tasks: SearchResult[]) =>
      tasks.map((t) => ({
        id: t.id,
        projectId: t.project_id,
        number: t.number,
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectKey: t.project_key,
        projectName: t.project_name,
        projectColor: t.project_color,
      }));

    try {
      // FULLTEXT search (MariaDB MATCH ... AGAINST)
      let tasks: SearchResult[];
      if (projectId !== undefined) {
        tasks = await db.$queryRaw<SearchResult[]>(
          Prisma.sql`
            SELECT t.id, t.project_id, t.number, t.title, t.status, t.priority,
                   p.key AS project_key, p.name AS project_name, p.color AS project_color
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE MATCH(t.title, t.description) AGAINST (${q} IN BOOLEAN MODE)
              AND t.project_id = ${projectId}
            ORDER BY t.number DESC
            LIMIT 30
          `
        );
      } else {
        tasks = await db.$queryRaw<SearchResult[]>(
          Prisma.sql`
            SELECT t.id, t.project_id, t.number, t.title, t.status, t.priority,
                   p.key AS project_key, p.name AS project_name, p.color AS project_color
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE MATCH(t.title, t.description) AGAINST (${q} IN BOOLEAN MODE)
            ORDER BY p.id, t.number DESC
            LIMIT 30
          `
        );
      }
      return reply.send(mapResults(tasks));
    } catch {
      // Fallback LIKE si l'index FULLTEXT n'est pas encore appliqué
      const tasks = await db.task.findMany({
        where: {
          ...(projectId !== undefined ? { projectId } : {}),
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
          ],
        },
        include: {
          project: { select: { key: true, name: true, color: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      return reply.send(
        tasks.map((t) => ({
          id: t.id,
          projectId: t.projectId,
          number: t.number,
          title: t.title,
          status: t.status,
          priority: t.priority,
          projectKey: t.project?.key ?? null,
          projectName: t.project?.name ?? "",
          projectColor: t.project?.color ?? "#6366f1",
        }))
      );
    }
  });
}
