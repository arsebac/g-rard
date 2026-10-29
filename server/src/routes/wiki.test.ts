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
      (db.wikiPage.findFirst as any).mockResolvedValue({
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
      (db.wikiPage.findFirst as any).mockResolvedValue(null);

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
      (db.wikiPage.findFirst as any).mockResolvedValue({ id: 1, projectId: null });
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
      (db.wikiPage.findFirst as any).mockResolvedValue({ id: 1, projectId: null });
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
      (db.wikiPage.findFirst as any).mockResolvedValue(projectPage);
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
        { method: "GET", url: "/api/wiki/pages/secret" },
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

  describe("Slugs", () => {
    const headers = { "x-api-key": "test-api-key" };

    beforeEach(() => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.wikiPage.findFirst as any).mockReset();
      (db.wikiPage.create as any).mockReset();
      (db.wikiPage.update as any).mockReset();
    });

    it("GET resolves a page by slug", async () => {
      (db.wikiPage.findFirst as any).mockResolvedValue({ id: 7, projectId: null, slug: "deploy-recipe", children: [] });
      const response = await app.inject({ method: "GET", url: "/api/wiki/pages/deploy-recipe", headers });
      expect(response.statusCode).toBe(200);
      expect((db.wikiPage.findFirst as any).mock.calls[0][0].where).toEqual({ slug: "deploy-recipe" });
    });

    it("GET with a numeric ref looks up by ID", async () => {
      (db.wikiPage.findFirst as any).mockResolvedValue({ id: 7, projectId: null, children: [] });
      await app.inject({ method: "GET", url: "/api/wiki/pages/7", headers });
      expect((db.wikiPage.findFirst as any).mock.calls[0][0].where).toEqual({ id: 7 });
    });

    it("POST keeps a custom slug", async () => {
      (db.wikiPage.findFirst as any).mockResolvedValue(null);
      (db.wikiPage.create as any).mockImplementation(async ({ data }: any) => ({ id: 1, ...data }));
      const response = await app.inject({
        method: "POST",
        url: "/api/wiki/pages",
        payload: { title: "Some long title", slug: "short-name" },
        headers,
      });
      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).slug).toBe("short-name");
    });

    it("POST refuses a slug already in use", async () => {
      (db.wikiPage.findFirst as any).mockResolvedValue({ id: 3 });
      const response = await app.inject({
        method: "POST",
        url: "/api/wiki/pages",
        payload: { title: "T", slug: "taken" },
        headers,
      });
      expect(response.statusCode).toBe(409);
      expect(db.wikiPage.create).not.toHaveBeenCalled();
    });

    it("POST rejects malformed slugs", async () => {
      for (const slug of ["Upper-Case", "with space", "trailing-", "123", "a--b"]) {
        const response = await app.inject({ method: "POST", url: "/api/wiki/pages", payload: { title: "T", slug }, headers });
        expect(response.statusCode, slug).toBe(400);
      }
    });

    it("POST gives a numeric title a slug that is not mistaken for an ID", async () => {
      (db.wikiPage.findFirst as any).mockResolvedValue(null);
      (db.wikiPage.create as any).mockImplementation(async ({ data }: any) => ({ id: 1, ...data }));
      const response = await app.inject({ method: "POST", url: "/api/wiki/pages", payload: { title: "2026" }, headers });
      expect(JSON.parse(response.payload).slug).toBe("page-2026");
    });

    it("PATCH renaming a page keeps its slug", async () => {
      (db.wikiPage.findFirst as any).mockResolvedValue({ id: 1, projectId: null });
      (db.wikiPage.update as any).mockResolvedValue({ id: 1 });
      await app.inject({ method: "PATCH", url: "/api/wiki/pages/1", payload: { title: "New title" }, headers });
      expect((db.wikiPage.update as any).mock.calls[0][0].data).toEqual({ title: "New title" });
    });

    it("PATCH changes the slug when asked, and refuses a taken one", async () => {
      (db.wikiPage.findFirst as any)
        .mockResolvedValueOnce({ id: 1, projectId: null })
        .mockResolvedValueOnce(null);
      (db.wikiPage.update as any).mockResolvedValue({ id: 1, slug: "renamed" });
      const ok = await app.inject({ method: "PATCH", url: "/api/wiki/pages/old-slug", payload: { slug: "renamed" }, headers });
      expect(ok.statusCode).toBe(200);
      expect((db.wikiPage.update as any).mock.calls[0][0]).toEqual({ where: { id: 1 }, data: { slug: "renamed" } });

      (db.wikiPage.findFirst as any)
        .mockResolvedValueOnce({ id: 1, projectId: null })
        .mockResolvedValueOnce({ id: 2 });
      const conflict = await app.inject({ method: "PATCH", url: "/api/wiki/pages/1", payload: { slug: "taken" }, headers });
      expect(conflict.statusCode).toBe(409);
    });
  });

  describe("GET /api/wiki/search", () => {
    const headers = { "x-api-key": "test-api-key" };

    beforeEach(() => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
    });

    it("returns nothing below 2 characters", async () => {
      (db.wikiPage.findMany as any).mockClear();
      const response = await app.inject({ method: "GET", url: "/api/wiki/search?q=a", headers });
      expect(JSON.parse(response.payload)).toEqual([]);
      expect(db.wikiPage.findMany).not.toHaveBeenCalled();
    });

    it("searches title, slug and body within accessible pages, title hits first, with a snippet", async () => {
      (db.wikiPage.findMany as any).mockResolvedValue([
        { id: 1, title: "Other", slug: "other", projectId: null, parentId: null, body: "intro about traefik routes", updatedAt: "" },
        { id: 2, title: "Traefik setup", slug: "traefik-setup", projectId: null, parentId: null, body: "", updatedAt: "" },
      ]);
      const response = await app.inject({ method: "GET", url: "/api/wiki/search?q=Traefik&projectId=10", headers });
      const results = JSON.parse(response.payload);
      expect(results.map((r: any) => r.id)).toEqual([2, 1]);
      expect(results[1].snippet).toContain("traefik");
      expect(results[1].body).toBeUndefined();

      const where = (db.wikiPage.findMany as any).mock.calls.at(-1)[0].where;
      expect(where.AND).toEqual([
        { OR: [{ projectId: null }, { project: { members: { some: { userId: 1 } } } }] },
        { projectId: 10 },
        { OR: [{ title: { contains: "Traefik" } }, { slug: { contains: "Traefik" } }, { body: { contains: "Traefik" } }] },
      ]);
    });
  });
});
