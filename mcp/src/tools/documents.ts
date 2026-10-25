import { z } from "zod";
import type { ApiClient } from "../client.js";
import type { Document, DocumentSpace, SpaceMember } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

export function formatSpace(s: DocumentSpace) {
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    description: s.description,
    parentId: s.parentId,
    documentCount: s._count?.documents ?? 0,
    subfolderCount: s._count?.children ?? 0,
  };
}

export function formatDocument(d: Document, api: ApiClient) {
  return {
    id: d.id,
    spaceId: d.spaceId,
    title: d.title,
    description: d.description,
    filename: d.filename,
    mimeType: d.mimeType,
    uploadedBy: d.uploader?.name ?? null,
    createdAt: d.createdAt,
    downloadUrl: `${api.baseUrl}/api/documents/${d.id}/download`,
  };
}

const spaceIdSchema = {
  type: "object" as const,
  properties: { spaceId: { type: "number", description: "Space ID" } },
  required: ["spaceId"],
};
const spaceIdArgs = z.object({ spaceId: z.number() });

export const documentTools: Tool[] = [
  {
    name: "list_document_spaces",
    description: "List all document spaces accessible to the current user (top-level spaces and their subfolders)",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async (_args, api) => {
      const spaces = await api.get<DocumentSpace[]>("/api/document-spaces");
      return ok(spaces.map(formatSpace));
    },
  },
  {
    name: "create_document_space",
    description: "Create a new document space (or subfolder inside an existing space)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Space name" },
        description: { type: "string", description: "Optional description" },
        color: { type: "string", description: "Hex color (e.g. #6366f1)" },
        parentId: { type: "number", description: "Parent space ID to create a subfolder (optional)" },
      },
      required: ["name"],
    },
    handler: async (args, api) => {
      const { name, description, color, parentId } = z
        .object({
          name: z.string().min(1),
          description: z.string().optional(),
          color: z.string().optional(),
          parentId: z.number().optional(),
        })
        .parse(args);
      const space = await api.post<DocumentSpace>("/api/document-spaces", {
        name,
        description: description ?? null,
        color: color ?? "#6366f1",
        parentId: parentId ?? null,
      });
      return ok(formatSpace(space));
    },
  },
  {
    name: "list_documents",
    description: "List documents in a space",
    inputSchema: spaceIdSchema,
    handler: async (args, api) => {
      const { spaceId } = spaceIdArgs.parse(args);
      const docs = await api.get<Document[]>(`/api/document-spaces/${spaceId}/documents`);
      return ok(docs.map((d) => formatDocument(d, api)));
    },
  },
  {
    name: "upload_document",
    description:
      "Upload a document to a space. The file content must be provided as a base64-encoded string. Tip: read the file with your Read tool and encode it with btoa() or Buffer.from(content).toString('base64').",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "number", description: "Target space ID" },
        filename: { type: "string", description: "Original filename (e.g. contrat.pdf)" },
        mimeType: { type: "string", description: "MIME type (e.g. application/pdf)" },
        content_base64: { type: "string", description: "File content encoded in base64" },
        title: { type: "string", description: "Document title (defaults to filename)" },
        description: { type: "string", description: "Optional description" },
      },
      required: ["spaceId", "filename", "mimeType", "content_base64"],
    },
    handler: async (args, api) => {
      const { spaceId, filename, mimeType, content_base64, title, description } = z
        .object({
          spaceId: z.number(),
          filename: z.string().min(1),
          mimeType: z.string().min(1),
          content_base64: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
        })
        .parse(args);
      const fields: Record<string, string> = {};
      if (title) fields.title = title;
      if (description) fields.description = description;
      const doc = await api.upload<Document>(
        `/api/document-spaces/${spaceId}/documents`,
        { filename, mimeType, contentBase64: content_base64 },
        fields
      );
      return ok(formatDocument(doc, api));
    },
  },
  {
    name: "delete_document",
    description: "Delete a document from a space",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Document ID" } },
      required: ["id"],
    },
    handler: async (args, api) => {
      const { id } = z.object({ id: z.number() }).parse(args);
      await api.delete(`/api/documents/${id}`);
      return ok({ success: true });
    },
  },
  {
    name: "list_space_members",
    description: "List members of a document space and their roles",
    inputSchema: spaceIdSchema,
    handler: async (args, api) => {
      const { spaceId } = spaceIdArgs.parse(args);
      const members = await api.get<SpaceMember[]>(`/api/document-spaces/${spaceId}/members`);
      return ok(members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, role: m.role })));
    },
  },
  {
    name: "add_space_member",
    description: "Share a document space with another user",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "number", description: "Space ID" },
        userId: { type: "number", description: "User ID to add" },
        role: { type: "string", enum: ["editor", "viewer"], description: "Role to grant" },
      },
      required: ["spaceId", "userId", "role"],
    },
    handler: async (args, api) => {
      const { spaceId, userId, role } = z
        .object({ spaceId: z.number(), userId: z.number(), role: z.enum(["editor", "viewer"]) })
        .parse(args);
      const member = await api.post<SpaceMember>(`/api/document-spaces/${spaceId}/members`, { userId, role });
      return ok({ userId: member.userId, name: member.user.name, role: member.role });
    },
  },
  {
    name: "remove_space_member",
    description: "Remove a user from a document space",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "number", description: "Space ID" },
        userId: { type: "number", description: "User ID to remove" },
      },
      required: ["spaceId", "userId"],
    },
    handler: async (args, api) => {
      const { spaceId, userId } = z.object({ spaceId: z.number(), userId: z.number() }).parse(args);
      await api.delete(`/api/document-spaces/${spaceId}/members/${userId}`);
      return ok({ success: true });
    },
  },
];
