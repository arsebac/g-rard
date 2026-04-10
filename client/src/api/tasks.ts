import { api } from "./client";
import { User } from "./auth";
import { Label } from "./projects";
import { TicketType } from "./ticketTypes";

export interface Task {
  id: number;
  projectId: number;
  number: number;
  projectKey?: string | null;
  title: string;
  description: string | null;
  status: "a_faire" | "en_cours" | "termine" | "bloque";
  priority: "basse" | "normale" | "haute" | "urgente";
  assigneeId: number | null;
  createdBy: number;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  position: number;
  typeId: number | null;
  parentId: number | null;
  sprintId: number | null;
  createdAt: string;
  updatedAt: string;
  assignee?: Pick<User, "id" | "name" | "avatarUrl"> | null;
  creator?: Pick<User, "id" | "name" | "avatarUrl">;
  labels?: { taskId: number; labelId: number; label: Label }[];
  type?: TicketType | null;
  parent?: { id: number; number: number; title: string; project: { key: string | null } } | null;
  sprint?: any | null;
  _count?: { comments: number };
}

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  assigneeId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  dueDate?: string | null;
  typeId?: number | null;
  parentId?: number | null;
  sprintId?: number | null;
}

export const tasksApi = {
  list: (
    projectId: number,
    filters?: {
      status?: string;
      assigneeId?: number;
      labelId?: number;
      typeId?: number;
      dueDateFrom?: string;
      dueDateTo?: string;
      startDateFrom?: string;
      startDateTo?: string;
      endDateFrom?: string;
      endDateTo?: string;
      sprintId?: number | null;
    }
  ) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.assigneeId) params.set("assigneeId", String(filters.assigneeId));
    if (filters?.labelId) params.set("labelId", String(filters.labelId));
    if (filters?.typeId) params.set("typeId", String(filters.typeId));
    if (filters?.dueDateFrom) params.set("dueDateFrom", filters.dueDateFrom);
    if (filters?.dueDateTo) params.set("dueDateTo", filters.dueDateTo);
    if (filters?.startDateFrom) params.set("startDateFrom", filters.startDateFrom);
    if (filters?.startDateTo) params.set("startDateTo", filters.startDateTo);
    if (filters?.endDateFrom) params.set("endDateFrom", filters.endDateFrom);
    if (filters?.endDateTo) params.set("endDateTo", filters.endDateTo);
    if (filters?.sprintId !== undefined) params.set("sprintId", String(filters.sprintId));
    const qs = params.toString();
    return api.get<Task[]>(`/api/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => api.get<Task>(`/api/tasks/${id}`),
  create: (projectId: number, data: CreateTaskData) =>
    api.post<Task>(`/api/projects/${projectId}/tasks`, data),
  update: (id: number, data: Partial<CreateTaskData>) =>
    api.patch<Task>(`/api/tasks/${id}`, data),
  move: (id: number, status: Task["status"], position: number, sprintId?: number | null) =>
    api.patch<Task>(`/api/tasks/${id}/move`, { status, position, sprintId }),
  delete: (id: number) => api.delete(`/api/tasks/${id}`),
  getByRef: (key: string, number: number) =>
    api.get<Task>(`/api/tasks/ref/${key}/${number}`),
};
