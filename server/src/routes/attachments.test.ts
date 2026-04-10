import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    attachment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    task: { findUnique: vi.fn() },
    wikiPage: { findUnique: vi.fn() },
  },
}));

vi.mock("../services/storage", async () => {
  const { Readable } = await import("stream");
  return {
    storageService: {
      saveFile: vi.fn().mockResolvedValue("stored/path"),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      getAbsolutePath: vi.fn().mockReturnValue("/abs/path"),
      getStream: vi.fn().mockImplementation(() => Readable.from(["test content"])),
    },
  };
});

vi.mock("../plugins/auth", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getProjectAccess: vi.fn(),
  };
});

import { db } from "../db";
import { getProjectAccess } from "../plugins/auth";

describe("Attachments Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/attachments", () => {
    it("Happy Path : Liste des pièces jointes", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ projectId: 10 });
      (getProjectAccess as any).mockResolvedValue("member");
      (db.attachment.findMany as any).mockResolvedValue([{ id: 1, filename: "file.txt" }]);

      const response = await app.inject({
        method: "GET",
        url: "/api/attachments",
        query: { entityType: "task", entityId: "1" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });

    it("Erreur 400 : Paramètres manquants", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      const response = await app.inject({
        method: "GET",
        url: "/api/attachments",
        headers: { "x-api-key": "test-api-key" },
      });
      expect(response.statusCode).toBe(400);
    });

    it("Erreur 403 : Accès refusé au projet", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ projectId: 10 });
      (getProjectAccess as any).mockResolvedValue(null); // No access

      const response = await app.inject({
        method: "GET",
        url: "/api/attachments",
        query: { entityType: "task", entityId: "1" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/attachments/:id/download", () => {
    it("Happy Path : Téléchargement", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.attachment.findUnique as any).mockResolvedValue({ 
        id: 1, 
        entityType: "project", 
        entityId: 10, 
        storedPath: "path/to/file" 
      });
      (getProjectAccess as any).mockResolvedValue("member");

      const response = await app.inject({
        method: "GET",
        url: "/api/attachments/1/download",
        headers: { "x-api-key": "test-api-key" },
      });

      // On s'attend à ce que sendFile soit appelé. 
      // Fastify inject retournera le contenu du fichier si le mock de sendFile fonctionne ou si on laisse faire.
      // Ici on vérifie surtout le status si les mocks passent.
      expect(response.statusCode).toBe(200);
    });

    it("Erreur 404 : Fichier introuvable", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.attachment.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/attachments/999/download",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/attachments/:id", () => {
    it("Happy Path : Suppression réussie", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.attachment.findUnique as any).mockResolvedValue({ id: 1, uploadedBy: 1, storedPath: "path" });
      (db.attachment.delete as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/attachments/1",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });

    it("Erreur 403 : IDOR (Pas l'uploadeur)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.attachment.findUnique as any).mockResolvedValue({ id: 1, uploadedBy: 2, storedPath: "path" });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/attachments/1",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
