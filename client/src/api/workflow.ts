import { api } from "./client";

export interface WorkflowTransition {
  id: number;
  projectId: number;
  fromStatus: string;
  toStatus: string;
}

export const workflowApi = {
  get: (projectId: number) =>
    api.get<WorkflowTransition[]>(`/api/projects/${projectId}/workflow`),

  save: (projectId: number, transitions: { fromStatus: string; toStatus: string }[]) =>
    api.put<WorkflowTransition[]>(`/api/projects/${projectId}/workflow`, { transitions }),
};
