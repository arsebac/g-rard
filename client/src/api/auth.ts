import { api } from "./client";

export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export const authApi = {
  me: () => api.get<User>("/api/auth/me"),
  login: (email: string, password: string) =>
    api.post<User>("/api/auth/login", { email, password }),
  logout: () => api.post<void>("/api/auth/logout"),
  register: (name: string, email: string, password: string) =>
    api.post<User>("/api/auth/register", { name, email, password }),
};
