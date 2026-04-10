import { api } from "./client";

export type SprintStatus = "futur" | "actif" | "termine";

export interface Sprint {
  id: number;
  projectId: number;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
}

export interface CreateSprintData {
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: SprintStatus;
}

export const sprintsApi = {
  list: (projectId: number) => api.get<Sprint[]>(`/api/projects/${projectId}/sprints`),
  create: (projectId: number, data: CreateSprintData) => api.post<Sprint>(`/api/projects/${projectId}/sprints`, data),
  update: (id: number, data: Partial<CreateSprintData>) => api.patch<Sprint>(`/api/sprints/${id}`, data),
  delete: (id: number) => api.delete(`/api/sprints/${id}`),
};
