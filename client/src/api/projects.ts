import { api } from "./client";
import { User } from "./auth";
import { ProjectColumn } from "./projectColumns";
import { WorkflowTransition } from "./workflow";

export interface Project {
  id: number;
  name: string;
  key: string | null;
  description: string | null;
  color: string;
  status: "actif" | "archive";
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  creator?: Pick<User, "id" | "name" | "avatarUrl">;
  _count?: { tasks: number };
  labels?: Label[];
  columns?: ProjectColumn[];
  workflowTransitions?: WorkflowTransition[];
}

export interface Label {
  id: number;
  projectId: number;
  name: string;
  color: string;
}

export type ProjectMemberRole = "admin" | "member" | "viewer";

export interface ProjectMember {
  userId: number;
  role: ProjectMemberRole;
  createdAt: string;
  user: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
}

export const membersApi = {
  list: (projectId: number) =>
    api.get<ProjectMember[]>(`/api/projects/${projectId}/members`),
  add: (projectId: number, data: { userId: number; role: ProjectMemberRole }) =>
    api.post<ProjectMember>(`/api/projects/${projectId}/members`, data),
  updateRole: (projectId: number, userId: number, role: ProjectMemberRole) =>
    api.patch<ProjectMember>(`/api/projects/${projectId}/members/${userId}`, { role }),
  remove: (projectId: number, userId: number) =>
    api.delete(`/api/projects/${projectId}/members/${userId}`),
};

export const projectsApi = {
  list: () => api.get<Project[]>("/api/projects"),
  get: (id: number) => api.get<Project>(`/api/projects/${id}`),
  getByKey: (key: string) => api.get<Project>(`/api/projects/by-key/${key}`),
  create: (data: { name: string; key?: string; description?: string; color?: string }) =>
    api.post<Project>("/api/projects", data),
  update: (id: number, data: Partial<Project>) =>
    api.patch<Project>(`/api/projects/${id}`, data),
  delete: (id: number, hard = false) => api.delete(`/api/projects/${id}${hard ? "?hard=true" : ""}`),
};
