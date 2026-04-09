import { api } from "./client";
import { User } from "./auth";

export const usersApi = {
  list: () => api.get<User[]>("/api/users"),
  update: (id: number, data: { name?: string }) =>
    api.patch<User>(`/api/users/${id}`, data),
  changePassword: (id: number, data: { currentPassword: string; newPassword: string }) =>
    api.patch(`/api/users/${id}/password`, data),
};
