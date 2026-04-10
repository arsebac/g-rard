import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    wikiPage: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from "../db";

describe("Wiki Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/wiki", () => {
    it("Happy Path : Liste toutes les pages", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.findMany as any).mockResolvedValue([{ id: 1, title: "Test Page", slug: "test-page" }]);

      const response = await app.inject({
        method: "GET",
        url: "/api/wiki",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });

    it("Erreur 401 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/wiki",
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/projects/:id/wiki", () => {
    it("Happy Path : Liste les pages d'un projet", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.findMany as any).mockResolvedValue([{ id: 1, title: "Project Page" }]);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/10/wiki",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });
  });

  describe("POST /api/wiki/pages", () => {
    it("Happy Path : Création de page", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.findFirst as any).mockResolvedValue(null); // uniqueSlug check
      (db.wikiPage.create as any).mockResolvedValue({ id: 1, title: "New Page", slug: "new-page" });

      const response = await app.inject({
        method: "POST",
        url: "/api/wiki/pages",
        payload: { title: "New Page", body: "Content" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).title).toBe("New Page");
    });

    it("Erreur 400 : Validation échouée", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      const response = await app.inject({
        method: "POST",
        url: "/api/wiki/pages",
        payload: { title: "" }, // min(1) failed
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/wiki/pages/:id", () => {
    it("Happy Path : Détail de la page", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.findUnique as any).mockResolvedValue({ 
        id: 1, 
        title: "Page 1", 
        creator: { id: 1, name: "User" },
        children: []
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/wiki/pages/1",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).id).toBe(1);
    });

    it("Erreur 404 : Page introuvable", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/wiki/pages/999",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/wiki/pages/:id", () => {
    it("Happy Path : Mise à jour de la page", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.findFirst as any).mockResolvedValue(null); // uniqueSlug check
      (db.wikiPage.update as any).mockResolvedValue({ id: 1, title: "Updated Page" });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/wiki/pages/1",
        payload: { title: "Updated Page" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).title).toBe("Updated Page");
    });

    it("Erreur 400 : Données invalides", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      const response = await app.inject({
        method: "PATCH",
        url: "/api/wiki/pages/1",
        payload: { title: "" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/wiki/pages/:id", () => {
    it("Happy Path : Suppression de la page", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.updateMany as any).mockResolvedValue({ count: 0 });
      (db.wikiPage.delete as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/wiki/pages/1",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });
  });

  describe("GET /api/wiki/pages/:id/export-md", () => {
    it("Happy Path : Export Markdown", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.findUnique as any).mockResolvedValue({ id: 1, slug: "test", body: "# Test" });

      const response = await app.inject({
        method: "GET",
        url: "/api/wiki/pages/1/export-md",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/markdown");
      expect(response.payload).toBe("# Test");
    });
  });
});
