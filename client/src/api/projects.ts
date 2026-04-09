import { api } from "./client";
import { User } from "./auth";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  color: string;
  status: "actif" | "archive";
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  creator?: Pick<User, "id" | "name" | "avatarUrl">;
  _count?: { tasks: number };
  labels?: Label[];
}

export interface Label {
  id: number;
  projectId: number;
  name: string;
  color: string;
}

export const projectsApi = {
  list: () => api.get<Project[]>("/api/projects"),
  get: (id: number) => api.get<Project>(`/api/projects/${id}`),
  create: (data: { name: string; description?: string; color?: string }) =>
    api.post<Project>("/api/projects", data),
  update: (id: number, data: Partial<Project>) =>
    api.patch<Project>(`/api/projects/${id}`, data),
  archive: (id: number) => api.delete(`/api/projects/${id}`),
};
