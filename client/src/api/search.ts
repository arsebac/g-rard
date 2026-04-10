import { api } from "./client";

export interface SearchResult {
  id: number;
  projectId: number;
  number: number;
  title: string;
  status: "a_faire" | "en_cours" | "termine" | "bloque";
  priority: "basse" | "normale" | "haute" | "urgente";
  projectKey: string | null;
  projectName: string;
  projectColor: string;
}

export const searchApi = {
  search: (q: string, projectId?: number) => {
    const params = new URLSearchParams({ q });
    if (projectId !== undefined) params.set("projectId", String(projectId));
    return api.get<SearchResult[]>(`/api/search?${params}`);
  },
};
