import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecurrenceType, RecurringTask } from "@prisma/client";
// We need to access computeDates, but it's not exported. 
// For testing purposes, we might need to export it or test via generateOccurrences.
// Since I can't easily change the source to export it without another turn, 
// I'll test generateOccurrences with a mocked prisma.

import { generateOccurrences } from "./recurringTaskGenerator";

describe("recurringTaskGenerator", () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    task: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ maxNumber: 10 }]),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseTemplate: RecurringTask = {
    id: 1,
    projectId: 1,
    title: "Test Recurring",
    description: "Desc",
    priority: "normale",
    recurrenceType: RecurrenceType.EVERY_N_WEEKS,
    intervalWeeks: 1,
    daysBeforeEndOfMonth: null,
    customDates: null,
    assigneeId: null,
    typeId: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should generate weekly occurrences for the next 15 months", async () => {
    await generateOccurrences(baseTemplate, mockPrisma);

    expect(mockPrisma.task.deleteMany).toHaveBeenCalled();
    // 15 months is roughly 65 weeks
    expect(mockPrisma.task.create).toHaveBeenCalledTimes(66); 
    
    const firstCall = mockPrisma.task.create.mock.calls[0][0].data;
    expect(firstCall.dueDate.toISOString()).toBe("2026-04-20T00:00:00.000Z");
    expect(firstCall.number).toBe(11);
  });

  it("should generate custom dates when provided", async () => {
    const template = {
      ...baseTemplate,
      recurrenceType: RecurrenceType.CUSTOM_DATES,
      customDates: ["2026-05-01", "2026-06-01"],
    };

    await generateOccurrences(template, mockPrisma);

    expect(mockPrisma.task.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.task.create.mock.calls[0][0].data.dueDate.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(mockPrisma.task.create.mock.calls[1][0].data.dueDate.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("should generate monthly dates before end of month", async () => {
    const template = {
      ...baseTemplate,
      recurrenceType: RecurrenceType.MONTHLY_BEFORE_END,
      daysBeforeEndOfMonth: 2,
    };

    await generateOccurrences(template, mockPrisma);

    // 15 months
    expect(mockPrisma.task.create).toHaveBeenCalledTimes(15); // April 2026 to June 2027 (15 months horizon)
    
    // April 2026 has 30 days. 30 - 2 = 28.
    expect(mockPrisma.task.create.mock.calls[0][0].data.dueDate.toISOString()).toBe("2026-04-28T00:00:00.000Z");
  });
});
