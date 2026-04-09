import { api } from "./client";

export type WikiContentType = "tiptap" | "markdown";

export interface WikiPage {
  id: number;
  title: string;
  slug: string;
  projectId: number | null;
  parentId: number | null;
  body: string | null;
  contentType: WikiContentType;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  children?: Pick<WikiPage, "id" | "title" | "slug" | "parentId">[];
  creator?: { id: number; name: string; avatarUrl: string | null };
}

export interface WikiPageSummary {
  id: number;
  title: string;
  slug: string;
  projectId: number | null;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWikiPageData {
  title: string;
  projectId?: number | null;
  parentId?: number | null;
  body?: string | null;
  contentType?: WikiContentType;
}

export interface UpdateWikiPageData {
  title?: string;
  body?: string | null;
}

export const wikiApi = {
  list: () => api.get<WikiPageSummary[]>("/api/wiki"),
  listByProject: (projectId: number) =>
    api.get<WikiPageSummary[]>(`/api/projects/${projectId}/wiki`),
  get: (id: number) => api.get<WikiPage>(`/api/wiki/pages/${id}`),
  create: (data: CreateWikiPageData) =>
    api.post<WikiPage>("/api/wiki/pages", data),
  update: (id: number, data: UpdateWikiPageData) =>
    api.patch<WikiPage>(`/api/wiki/pages/${id}`, data),
  delete: (id: number) => api.delete(`/api/attachments/${id}`),
  deleteWiki: (id: number) => api.delete(`/api/wiki/pages/${id}`),

  importMd: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<WikiPage>("/api/wiki/pages/import-md", formData);
  },

  getExportUrl: (id: number) => `${api.baseURL}/api/wiki/pages/${id}/export-md`,
};
