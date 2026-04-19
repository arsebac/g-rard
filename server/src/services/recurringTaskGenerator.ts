import { PrismaClient, RecurrenceType, RecurringTask, TaskStatus } from "@prisma/client";

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function computeDates(template: RecurringTask, overrideDates?: string[]): Date[] {
  const today = toDateOnly(new Date());
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + 15);

  if (template.recurrenceType === RecurrenceType.CUSTOM_DATES || overrideDates) {
    const raw = overrideDates ?? (template.customDates as string[] | null) ?? [];
    return raw
      .map((d) => toDateOnly(new Date(d)))
      .filter((d) => !isNaN(d.getTime()));
  }

  if (template.recurrenceType === RecurrenceType.EVERY_N_WEEKS) {
    const interval = template.intervalWeeks ?? 1;
    const dates: Date[] = [];
    let current = toDateOnly(new Date(today));
    while (current <= horizon) {
      dates.push(new Date(current));
      current = addWeeks(current, interval);
    }
    return dates;
  }

  if (template.recurrenceType === RecurrenceType.MONTHLY_BEFORE_END) {
    const daysBefore = template.daysBeforeEndOfMonth ?? 0;
    const dates: Date[] = [];
    let year = today.getUTCFullYear();
    let month = today.getUTCMonth();
    while (true) {
      const last = lastDayOfMonth(year, month);
      const target = toDateOnly(new Date(last));
      target.setUTCDate(target.getUTCDate() - daysBefore);
      if (target > horizon) break;
      if (target >= today) dates.push(target);
      month++;
      if (month > 11) { month = 0; year++; }
    }
    return dates;
  }

  return [];
}

export async function generateOccurrences(
  template: RecurringTask,
  prisma: PrismaClient,
  overrideDates?: string[]
): Promise<void> {
  const dates = computeDates(template, overrideDates);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Delete future pending tasks for this template
    await tx.task.deleteMany({
      where: {
        recurringTaskId: template.id,
        dueDate: { gt: now },
        status: TaskStatus.a_faire,
      },
    });

    // Get current max task number for the project
    const result = await tx.$queryRaw<{ maxNumber: number | null }[]>`
      SELECT MAX(number) as maxNumber FROM tasks WHERE project_id = ${template.projectId} FOR UPDATE
    `;
    let nextNumber = (result[0]?.maxNumber ?? 0) + 1;

    for (const date of dates) {
      await tx.task.create({
        data: {
          projectId: template.projectId,
          number: nextNumber++,
          title: template.title,
          description: template.description,
          priority: template.priority,
          assigneeId: template.assigneeId,
          typeId: template.typeId,
          dueDate: date,
          recurringTaskId: template.id,
          createdBy: template.createdBy,
        },
      });
    }
  });
}
