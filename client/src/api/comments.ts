import { api } from "./client";
import { User } from "./auth";

export interface Comment {
  id: number;
  taskId: number;
  authorId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, "id" | "name" | "avatarUrl">;
}

export interface ActivityLog {
  id: number;
  entityType: string;
  entityId: number;
  actorId: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: Pick<User, "id" | "name" | "avatarUrl">;
}

export const commentsApi = {
  list: (taskId: number) => api.get<Comment[]>(`/api/tasks/${taskId}/comments`),
  create: (taskId: number, body: string) =>
    api.post<Comment>(`/api/tasks/${taskId}/comments`, { body }),
  update: (id: number, body: string) =>
    api.patch<Comment>(`/api/comments/${id}`, { body }),
  delete: (id: number) => api.delete(`/api/comments/${id}`),
  activity: (taskId: number) =>
    api.get<ActivityLog[]>(`/api/tasks/${taskId}/activity`),
};
