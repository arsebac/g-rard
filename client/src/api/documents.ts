import { api } from "./client";

export interface DocumentSpace {
  id: number;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  parentId: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number; children: number };
}

export interface Document {
  id: number;
  spaceId: number;
  title: string;
  description: string | null;
  uploadedBy: number;
  filename: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  uploader?: { id: number; name: string; avatarUrl: string | null };
}

export const documentsApi = {
  listSpaces: () => api.get<DocumentSpace[]>("/api/document-spaces"),

  createSpace: (data: {
    name: string;
    icon?: string;
    color?: string;
    description?: string | null;
    parentId?: number | null;
    position?: number;
  }) => api.post<DocumentSpace>("/api/document-spaces", data),

  updateSpace: (
    id: number,
    data: { name?: string; icon?: string; color?: string; description?: string | null; position?: number }
  ) => api.patch<DocumentSpace>(`/api/document-spaces/${id}`, data),

  deleteSpace: (id: number) => api.delete(`/api/document-spaces/${id}`),

  listDocuments: (spaceId: number) =>
    api.get<Document[]>(`/api/document-spaces/${spaceId}/documents`),

  upload: (spaceId: number, file: File, title?: string, description?: string) => {
    const formData = new FormData();
    if (title) formData.append("title", title);
    if (description) formData.append("description", description);
    formData.append("file", file);
    return api.post<Document>(`/api/document-spaces/${spaceId}/documents`, formData);
  },

  updateDocument: (id: number, data: { title?: string; description?: string | null }) =>
    api.patch<Document>(`/api/documents/${id}`, data),

  deleteDocument: (id: number) => api.delete(`/api/documents/${id}`),

  getDownloadUrl: (id: number) => `${api.baseURL}/api/documents/${id}/download`,
};
