import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "./client.js";
import type { Document, DocumentSpace } from "./types.js";

/** Exposes documents as readable binary resources (gerard://documents/<id>). */
export function registerDocumentResources(server: Server, api: ApiClient) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const spaces = await api.get<DocumentSpace[]>("/api/document-spaces");
      const resources: { uri: string; name: string; mimeType: string; description: string }[] = [];
      for (const space of spaces) {
        const docs = await api.get<Document[]>(`/api/document-spaces/${space.id}/documents`);
        for (const doc of docs) {
          resources.push({
            uri: `gerard://documents/${doc.id}`,
            name: doc.title,
            mimeType: doc.mimeType,
            description: `[${space.name}] ${doc.filename} — ${new Date(doc.createdAt).toLocaleDateString()}`,
          });
        }
      }
      return { resources };
    } catch {
      return { resources: [] };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const match = uri.match(/^gerard:\/\/documents\/(\d+)$/);
    if (!match) throw new Error(`Unknown resource URI: ${uri}`);
    const { base64, mimeType } = await api.binary(`/api/documents/${match[1]}/download`);
    return { contents: [{ uri, mimeType, blob: base64 }] };
  });
}
