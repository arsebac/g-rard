import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import { db } from "../db";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    taskLink: { 
      findMany: vi.fn(), 
      create: vi.fn(), 
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe("Routes TaskLinks", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/tasks/:id/links", () => {
    it("Happy Path : Liste des liens d'une tâche", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
      (db.taskLink.findMany as any).mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/1/links",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toBeDefined();
    });

    it("Erreur 404 : Tâche introuvable", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/999/links",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/tasks/:id/links", () => {
    it("Happy Path : Création d'un lien", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
      (db.taskLink.create as any).mockResolvedValue({ id: 1, sourceId: 1, targetId: 2 });

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks/1/links",
        payload: { targetId: 2, linkType: "blocks" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(201);
    });

    it("Erreur 400 : Auto-lien", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks/1/links",
        payload: { targetId: 1, linkType: "blocks" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toContain("lui-même");
    });

    it("Erreur 400 : Validation (linkType invalide)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      const response = await app.inject({
        method: "POST",
        url: "/api/tasks/1/links",
        payload: { targetId: 2, linkType: "invalid_type" },
        headers: { "x-api-key": "test-api-key" },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/task-links/:id", () => {
    it("Happy Path : Suppression d'un lien", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.taskLink.findUnique as any).mockResolvedValue({ id: 1, sourceId: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
      (db.taskLink.delete as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/task-links/1",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
    });

    it("Erreur 403 : Accès refusé (IDOR)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 2 });
      (db.taskLink.findUnique as any).mockResolvedValue({ id: 1, sourceId: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [] });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/task-links/1",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("Authentification", () => {
    it("Erreur 401 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/1/links",
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("Project access", () => {
    const headers = { "x-api-key": "test-api-key" };
    // Task 1 lives in project 1, task 2 in project 2.
    function access(roles: Record<number, "admin" | "member" | "viewer" | null>) {
      (db.task.findUnique as any).mockImplementation(async ({ where }: any) => ({ id: where.id, projectId: where.id }));
      (db.project.findUnique as any).mockImplementation(async ({ where }: any) => {
        const role = roles[where.id];
        return { id: where.id, members: role ? [{ userId: 1, role }] : [] };
      });
    }

    it("non-member can neither list nor create links", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.taskLink.create as any).mockClear();
      access({ 1: null });
      expect((await app.inject({ method: "GET", url: "/api/tasks/1/links", headers })).statusCode).toBe(403);
      const response = await app.inject({
        method: "POST", url: "/api/tasks/1/links", headers,
        payload: { targetId: 2, linkType: "relates_to" },
      });
      expect(response.statusCode).toBe(403);
      expect(db.taskLink.create).not.toHaveBeenCalled();
    });

    it("refuses to link to a task in an inaccessible project", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.taskLink.create as any).mockClear();
      access({ 1: "member", 2: null });
      const response = await app.inject({
        method: "POST", url: "/api/tasks/1/links", headers,
        payload: { targetId: 2, linkType: "relates_to" },
      });
      expect(response.statusCode).toBe(403);
      expect(db.taskLink.create).not.toHaveBeenCalled();
    });

    it("links to hidden projects are filtered out of the listing", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      access({ 1: "viewer" });
      (db.taskLink.findMany as any).mockResolvedValue([]);
      expect((await app.inject({ method: "GET", url: "/api/tasks/1/links", headers })).statusCode).toBe(200);
      const [fromCall, toCall] = (db.taskLink.findMany as any).mock.calls.slice(-2).map((c: any) => c[0].where);
      const visible = { project: { members: { some: { userId: 1 } } } };
      expect(fromCall.target).toEqual(visible);
      expect(toCall.source).toEqual(visible);
    });
  });
});
