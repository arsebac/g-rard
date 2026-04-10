import { api } from "./client";

export interface ProjectColumn {
  id: number;
  projectId: number;
  statusKey: string;
  label: string;
  color: string;
  position: number;
  visible: boolean;
}

export const projectColumnsApi = {
  list: (projectId: number) =>
    api.get<ProjectColumn[]>(`/api/projects/${projectId}/columns`),

  update: (projectId: number, statusKey: string, data: Partial<Pick<ProjectColumn, "label" | "color" | "visible" | "position">>) =>
    api.patch<ProjectColumn>(`/api/projects/${projectId}/columns/${statusKey}`, data),

  reorder: (projectId: number, order: string[]) =>
    api.patch(`/api/projects/${projectId}/columns/reorder`, { order }),
};
