import { api } from "./client";

export interface TicketType {
  id: number;
  projectId: number;
  name: string;
  icon: string;
  color: string;
  isEpic: boolean;
  position: number;
  createdAt: string;
}

export const ticketTypesApi = {
  list: (projectId: number) =>
    api.get<TicketType[]>(`/api/projects/${projectId}/ticket-types`),

  create: (projectId: number, data: Partial<Omit<TicketType, "id" | "projectId" | "createdAt">>) =>
    api.post<TicketType>(`/api/projects/${projectId}/ticket-types`, data),

  update: (id: number, data: Partial<Omit<TicketType, "id" | "projectId" | "createdAt">>) =>
    api.patch<TicketType>(`/api/ticket-types/${id}`, data),

  delete: (id: number) => api.delete(`/api/ticket-types/${id}`),

  reorder: (projectId: number, order: number[]) =>
    api.patch(`/api/projects/${projectId}/ticket-types/reorder`, { order }),
};
