import { api } from "./client";
import { User } from "./auth";

export const usersApi = {
  list: () => api.get<User[]>("/api/users"),
  update: (id: number, data: { name?: string }) =>
    api.patch<User>(`/api/users/${id}`, data),
  changePassword: (id: number, data: { currentPassword: string; newPassword: string }) =>
    api.patch(`/api/users/${id}/password`, data),
  // The stored path changes on every upload, so it doubles as a cache buster.
  avatarSrc: (user: { id: number; avatarUrl?: string | null }) =>
    user.avatarUrl ? `${api.baseURL}/api/users/${user.id}/avatar?v=${encodeURIComponent(user.avatarUrl)}` : null,
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<User>("/api/users/me/avatar", formData);
  },
};
