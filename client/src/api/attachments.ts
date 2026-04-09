import { api } from "./client";

export type AttachmentType = "task" | "project" | "wiki_page";

export interface Attachment {
  id: number;
  entityType: AttachmentType;
  entityId: number;
  uploadedBy: number;
  filename: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader?: { id: number; name: string; avatarUrl: string | null };
}

export const attachmentsApi = {
  list: (entityType: AttachmentType, entityId: number) =>
    api.get<Attachment[]>(`/api/attachments?entityType=${entityType}&entityId=${entityId}`),

  upload: (entityType: AttachmentType, entityId: number, file: File) => {
    const formData = new FormData();
    // Les champs textuels doivent être ajoutés AVANT le fichier pour @fastify/multipart
    formData.append("entityType", entityType);
    formData.append("entityId", entityId.toString());
    formData.append("file", file);

    return api.post<Attachment>("/api/attachments", formData);
  },

  delete: (id: number) => api.delete(`/api/attachments/${id}`),

  getDownloadUrl: (id: number) => `${api.baseURL}/api/attachments/${id}/download`,
  
  getPublicUrl: (storedPath: string) => `${api.baseURL}/uploads/${storedPath}`,
};
