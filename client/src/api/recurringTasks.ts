import { api } from "./client";
import { User } from "./auth";
import { TicketType } from "./ticketTypes";

export type RecurrenceType = "EVERY_N_WEEKS" | "MONTHLY_BEFORE_END" | "CUSTOM_DATES";

export interface RecurringTask {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  priority: "basse" | "normale" | "haute" | "urgente";
  assigneeId: number | null;
  typeId: number | null;
  recurrenceType: RecurrenceType;
  intervalWeeks: number | null;
  daysBeforeEndOfMonth: number | null;
  customDates: string[] | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  creator?: Pick<User, "id" | "name" | "avatarUrl">;
  assignee?: Pick<User, "id" | "name" | "avatarUrl"> | null;
  type?: TicketType | null;
  _count?: { tasks: number };
  tasks?: { id: number; number: number; title: string; dueDate: string | null; status: string }[];
}

export interface CreateRecurringTaskData {
  title: string;
  description?: string | null;
  priority?: RecurringTask["priority"];
  assigneeId?: number | null;
  typeId?: number | null;
  recurrenceType: RecurrenceType;
  intervalWeeks?: number | null;
  daysBeforeEndOfMonth?: number | null;
  customDates?: string[] | null;
}

export const recurringTasksApi = {
  list: (projectId: number): Promise<RecurringTask[]> =>
    api.get(`/api/projects/${projectId}/recurring-tasks`),

  create: (projectId: number, data: CreateRecurringTaskData): Promise<RecurringTask> =>
    api.post(`/api/projects/${projectId}/recurring-tasks`, data),

  get: (id: number): Promise<RecurringTask> =>
    api.get(`/api/recurring-tasks/${id}`),

  update: (id: number, data: Partial<CreateRecurringTaskData>): Promise<RecurringTask> =>
    api.patch(`/api/recurring-tasks/${id}`, data),

  delete: (id: number): Promise<void> =>
    api.delete(`/api/recurring-tasks/${id}`),

  regenerate: (id: number, customDates?: string[]): Promise<RecurringTask> =>
    api.post(`/api/recurring-tasks/${id}/regenerate`, { customDates }),
};
