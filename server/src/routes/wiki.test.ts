import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { findUnique: vi.fn() },
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

// Makes the current user (id 1) hold `role` on project 10, or no role at all.
function memberOf(role: "admin" | "member" | "viewer" | null) {
  (db.project.findUnique as any).mockResolvedValue({
    id: 10,
    members: role ? [{ userId: 1, role }] : [],
  });
}

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
      memberOf("viewer");
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
      (db.wikiPage.findUnique as any).mockResolvedValue({ id: 1, projectId: null });
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
      (db.wikiPage.findUnique as any).mockResolvedValue({ id: 1, projectId: null });
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

  describe("Project access", () => {
    const projectPage = { id: 5, projectId: 10, title: "Secret", slug: "secret", body: "x", creator: null, children: [] };
    const headers = { "x-api-key": "test-api-key" };

    beforeEach(() => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.findUnique as any).mockResolvedValue(projectPage);
      (db.wikiPage.findFirst as any).mockResolvedValue(null);
      (db.wikiPage.update as any).mockClear();
      (db.wikiPage.delete as any).mockClear();
      (db.wikiPage.create as any).mockClear();
    });

    it("GET /api/wiki only asks for shared pages and the user's projects", async () => {
      (db.wikiPage.findMany as any).mockResolvedValue([]);
      await app.inject({ method: "GET", url: "/api/wiki", headers });
      const where = (db.wikiPage.findMany as any).mock.calls.at(-1)[0].where;
      expect(where).toEqual({
        OR: [{ projectId: null }, { project: { members: { some: { userId: 1 } } } }],
      });
    });

    it("non-member is refused on every page route", async () => {
      memberOf(null);
      const calls = [
        { method: "GET", url: "/api/projects/10/wiki" },
        { method: "GET", url: "/api/wiki/pages/5" },
        { method: "GET", url: "/api/wiki/pages/5/export-md" },
        { method: "PATCH", url: "/api/wiki/pages/5", payload: { body: "hacked" } },
        { method: "DELETE", url: "/api/wiki/pages/5" },
        { method: "POST", url: "/api/wiki/pages", payload: { title: "T", projectId: 10 } },
        { method: "POST", url: "/api/wiki/pages", payload: { title: "T", parentId: 5 } },
      ] as const;
      for (const call of calls) {
        const response = await app.inject({ ...call, headers } as any);
        expect(response.statusCode, `${call.method} ${call.url}`).toBe(403);
      }
      expect(db.wikiPage.update).not.toHaveBeenCalled();
      expect(db.wikiPage.delete).not.toHaveBeenCalled();
      expect(db.wikiPage.create).not.toHaveBeenCalled();
    });

    it("viewer can read but not write", async () => {
      memberOf("viewer");
      expect((await app.inject({ method: "GET", url: "/api/wiki/pages/5", headers })).statusCode).toBe(200);
      expect((await app.inject({ method: "PATCH", url: "/api/wiki/pages/5", payload: { body: "x" }, headers })).statusCode).toBe(403);
      expect((await app.inject({ method: "DELETE", url: "/api/wiki/pages/5", headers })).statusCode).toBe(403);
    });

    it("member can write", async () => {
      memberOf("member");
      (db.wikiPage.update as any).mockResolvedValue({ ...projectPage, body: "y" });
      (db.wikiPage.updateMany as any).mockResolvedValue({ count: 0 });
      (db.wikiPage.delete as any).mockResolvedValue(projectPage);
      expect((await app.inject({ method: "PATCH", url: "/api/wiki/pages/5", payload: { body: "y" }, headers })).statusCode).toBe(200);
      expect((await app.inject({ method: "DELETE", url: "/api/wiki/pages/5", headers })).statusCode).toBe(200);
    });
  });
});
