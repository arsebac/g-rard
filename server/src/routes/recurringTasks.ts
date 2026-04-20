import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireProjectViewer, requireProjectMember, getProjectAccess } from "../plugins/auth";
import { generateOccurrences } from "../services/recurringTaskGenerator";
import { Prisma, RecurrenceType } from "@prisma/client";

const RECURRING_INCLUDE = {
  creator: { select: { id: true, name: true, avatarUrl: true } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  type: true,
  _count: { select: { tasks: true } },
} as const;

const createRecurringSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  priority: z.enum(["basse", "normale", "haute", "urgente"]).default("normale"),
  assigneeId: z.number().optional().nullable(),
  typeId: z.number().optional().nullable(),
  recurrenceType: z.enum(["EVERY_N_WEEKS", "MONTHLY_BEFORE_END", "CUSTOM_DATES"]),
  intervalWeeks: z.number().int().min(1).optional().nullable(),
  daysBeforeEndOfMonth: z.number().int().min(0).optional().nullable(),
  customDates: z.array(z.string()).optional().nullable(),
});

const updateRecurringSchema = createRecurringSchema.partial();

const regenerateSchema = z.object({
  customDates: z.array(z.string()).optional(),
});

export default async function recurringTaskRoutes(app: FastifyInstance) {
  // List all templates for a project
  app.get(
    "/api/projects/:projectId/recurring-tasks",
    { preHandler: [requireAuth, requireProjectViewer] },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      const templates = await db.recurringTask.findMany({
        where: { projectId: parseInt(projectId) },
        include: RECURRING_INCLUDE,
        orderBy: { createdAt: "asc" },
      });
      return reply.send(templates);
    }
  );

  // Create a template and generate occurrences
  app.post(
    "/api/projects/:projectId/recurring-tasks",
    { preHandler: [requireAuth, requireProjectMember] },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      const body = createRecurringSchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
      }

      const { customDates, ...rest } = body.data;
      const template = await db.recurringTask.create({
        data: {
          ...rest,
          projectId: parseInt(projectId),
          createdBy: req.currentUserId,
          customDates: customDates ?? undefined,
          recurrenceType: rest.recurrenceType as RecurrenceType,
        },
        include: RECURRING_INCLUDE,
      });

      await generateOccurrences(template, db as any);

      const updated = await db.recurringTask.findUnique({
        where: { id: template.id },
        include: RECURRING_INCLUDE,
      });
      return reply.status(201).send(updated);
    }
  );

  // Get a single template with upcoming tasks
  app.get("/api/recurring-tasks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await db.recurringTask.findUnique({
      where: { id: parseInt(id) },
      include: {
        ...RECURRING_INCLUDE,
        tasks: {
          where: { dueDate: { gte: new Date() } },
          orderBy: { dueDate: "asc" },
          select: { id: true, number: true, title: true, dueDate: true, status: true },
        },
      },
    });
    if (!template) return reply.status(404).send({ error: "Recurring task not found" });

    const access = await getProjectAccess(req.currentUserId, template.projectId);
    if (!access) return reply.status(403).send({ error: "Access denied" });

    return reply.send(template);
  });

  // Update a template and regenerate future tasks
  app.patch("/api/recurring-tasks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await db.recurringTask.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return reply.status(404).send({ error: "Recurring task not found" });

    const access = await getProjectAccess(req.currentUserId, existing.projectId);
    if (!access) return reply.status(403).send({ error: "Access denied" });
    if ((access as string) === "viewer") return reply.status(403).send({ error: "Viewers cannot perform write operations" });

    const body = updateRecurringSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
    }

    const { customDates, recurrenceType, ...rest } = body.data;
    const updateData: Prisma.RecurringTaskUncheckedUpdateInput = {
      ...rest,
      ...(recurrenceType && { recurrenceType: recurrenceType as RecurrenceType }),
      ...(customDates !== undefined && { customDates: customDates === null ? Prisma.DbNull : customDates }),
    };
    const template = await db.recurringTask.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: RECURRING_INCLUDE,
    });

    await generateOccurrences(template, db as any);

    const updated = await db.recurringTask.findUnique({
      where: { id: template.id },
      include: RECURRING_INCLUDE,
    });
    return reply.send(updated);
  });

  // Delete a template and cancel future pending tasks
  app.delete("/api/recurring-tasks/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await db.recurringTask.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return reply.status(404).send({ error: "Recurring task not found" });

    const access = await getProjectAccess(req.currentUserId, existing.projectId);
    if (!access) return reply.status(403).send({ error: "Access denied" });
    if ((access as string) === "viewer") return reply.status(403).send({ error: "Viewers cannot perform write operations" });

    const now = new Date();
    // Delete future pending tasks
    await db.task.deleteMany({
      where: {
        recurringTaskId: parseInt(id),
        dueDate: { gt: now },
        status: "a_faire",
      },
    });
    // Detach past/completed tasks from the template
    await db.task.updateMany({
      where: { recurringTaskId: parseInt(id) },
      data: { recurringTaskId: null },
    });
    await db.recurringTask.delete({ where: { id: parseInt(id) } });

    return reply.send({ success: true });
  });

  // Regenerate occurrences (e.g., after receiving a garbage calendar)
  app.post("/api/recurring-tasks/:id/regenerate", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await db.recurringTask.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return reply.status(404).send({ error: "Recurring task not found" });

    const access = await getProjectAccess(req.currentUserId, existing.projectId);
    if (!access) return reply.status(403).send({ error: "Access denied" });
    if ((access as string) === "viewer") return reply.status(403).send({ error: "Viewers cannot perform write operations" });

    const body = regenerateSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
    }

    // If new custom dates provided, persist them on the template first
    let template = existing;
    if (body.data.customDates) {
      template = await db.recurringTask.update({
        where: { id: parseInt(id) },
        data: { customDates: body.data.customDates },
      });
    }

    await generateOccurrences(template, db as any, body.data.customDates);

    const updated = await db.recurringTask.findUnique({
      where: { id: parseInt(id) },
      include: RECURRING_INCLUDE,
    });
    return reply.send(updated);
  });
}
