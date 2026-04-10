import { api } from "./client";
import { Task } from "./tasks";

export type LinkType =
  | "blocks" | "is_blocked_by"
  | "relates_to"
  | "duplicates" | "is_duplicated_by"
  | "causes" | "is_caused_by";

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  blocks:           "Bloque",
  is_blocked_by:    "Est bloqué par",
  relates_to:       "Est lié à",
  duplicates:       "Duplique",
  is_duplicated_by: "Est dupliqué par",
  causes:           "Est la cause de",
  is_caused_by:     "Est causé par",
};

export const LINK_TYPES: LinkType[] = [
  "blocks", "is_blocked_by", "relates_to",
  "duplicates", "is_duplicated_by",
  "causes", "is_caused_by",
];

export interface TaskLink {
  id: number;
  linkType: LinkType;
  direction: "outbound" | "inbound";
  task: Task & { projectKey?: string | null };
}

export const taskLinksApi = {
  list: (taskId: number) => api.get<TaskLink[]>(`/api/tasks/${taskId}/links`),

  create: (taskId: number, data: { targetId: number; linkType: LinkType }) =>
    api.post(`/api/tasks/${taskId}/links`, data),

  delete: (linkId: number) => api.delete(`/api/task-links/${linkId}`),
};
