import { api } from "./client";
import { Label } from "./projects";

export const labelsApi = {
  list: (projectId: number) =>
    api.get<Label[]>(`/api/projects/${projectId}/labels`),
  create: (projectId: number, data: { name: string; color: string }) =>
    api.post<Label>(`/api/projects/${projectId}/labels`, data),
  update: (id: number, data: Partial<{ name: string; color: string }>) =>
    api.patch<Label>(`/api/labels/${id}`, data),
  delete: (id: number) => api.delete(`/api/labels/${id}`),
  addToTask: (taskId: number, labelId: number) =>
    api.post(`/api/tasks/${taskId}/labels/${labelId}`, {}),
  removeFromTask: (taskId: number, labelId: number) =>
    api.delete(`/api/tasks/${taskId}/labels/${labelId}`),
};
