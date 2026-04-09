import { api } from "./client";
import { User } from "./auth";
import { Label } from "./projects";

export interface Task {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  status: "a_faire" | "en_cours" | "termine" | "bloque";
  priority: "basse" | "normale" | "haute" | "urgente";
  assigneeId: number | null;
  createdBy: number;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  assignee?: Pick<User, "id" | "name" | "avatarUrl"> | null;
  creator?: Pick<User, "id" | "name" | "avatarUrl">;
  labels?: { taskId: number; labelId: number; label: Label }[];
  _count?: { comments: number };
}

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  assigneeId?: number | null;
  dueDate?: string | null;
}

export const tasksApi = {
  list: (projectId: number, filters?: { status?: string; assigneeId?: number; labelId?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.assigneeId) params.set("assigneeId", String(filters.assigneeId));
    if (filters?.labelId) params.set("labelId", String(filters.labelId));
    const qs = params.toString();
    return api.get<Task[]>(`/api/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => api.get<Task>(`/api/tasks/${id}`),
  create: (projectId: number, data: CreateTaskData) =>
    api.post<Task>(`/api/projects/${projectId}/tasks`, data),
  update: (id: number, data: Partial<CreateTaskData>) =>
    api.patch<Task>(`/api/tasks/${id}`, data),
  move: (id: number, status: Task["status"], position: number) =>
    api.patch<Task>(`/api/tasks/${id}/move`, { status, position }),
  delete: (id: number) => api.delete(`/api/tasks/${id}`),
};
