import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import { db } from "../db";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { findUnique: vi.fn(), findFirst: vi.fn() },
    task: { 
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    activityLog: { create: vi.fn() },
  },
}));

vi.mock("../services/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/projectKey", () => ({
  nextTaskNumber: vi.fn().mockResolvedValue(101),
}));

vi.mock("../services/sanitize", () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

describe("Routes Tasks", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/projects/:projectId/tasks", () => {
    it("Happy Path : Liste des tâches", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue({ 
        id: 1, 
        key: "PRJ",
        members: [{ userId: 1, role: "member" }] 
      });
      (db.task.findMany as any).mockResolvedValue([{ id: 1, title: "T1", status: "a_faire" }]);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1/tasks",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });

    it("Erreur 403 : Accès refusé", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [] });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1/tasks",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(403);
    });

    it("Erreur 401 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1/tasks",
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/projects/:projectId/tasks", () => {
    it("Happy Path : Création de tâche", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue({ 
        id: 1, 
        members: [{ userId: 1, role: "member" }] 
      });
      (db.task.findFirst as any).mockResolvedValue({ position: 1000 });
      (db.task.create as any).mockResolvedValue({ id: 1, title: "New Task" });

      const response = await app.inject({
        method: "POST",
        url: "/api/projects/1/tasks",
        payload: { title: "New Task" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).title).toBe("New Task");
    });

    it("Erreur 400 : Validation échouée", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });

      const response = await app.inject({
        method: "POST",
        url: "/api/projects/1/tasks",
        payload: { title: "" }, // Titre vide
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/tasks/ref/:key/:number", () => {
    it("Happy Path : Recherche par référence", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findFirst as any).mockResolvedValue({ id: 1, key: "PRJ" });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
      (db.task.findFirst as any).mockResolvedValue({ id: 1, title: "T1", projectId: 1 });

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/ref/PRJ/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).title).toBe("T1");
    });

    it("Erreur 404 : Projet inexistant", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findFirst as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/ref/INV/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(404);
    });

    it("Erreur 404 : Tâche inexistante", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findFirst as any).mockResolvedValue({ id: 1, key: "PRJ" });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
      (db.task.findFirst as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/ref/PRJ/999",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/tasks/:id", () => {
    it("Happy Path : Détails d'une tâche", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
    });

    it("Erreur 404 : Tâche introuvable", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/999",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(404);
    });

    it("Erreur 403 : Accès interdit", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 2 });
      (db.project.findUnique as any).mockResolvedValue({ id: 2, members: [] });

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PATCH /api/tasks/:id", () => {
    it("Happy Path : Mise à jour", async () => {
      const mockTask = { id: 1, projectId: 1, title: "Old", status: "a_faire", priority: "normale" };
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue(mockTask);
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
      (db.task.update as any).mockResolvedValue({ ...mockTask, title: "New" });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/tasks/1",
        payload: { title: "New" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).title).toBe("New");
    });

    it("Erreur 400 : Validation", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/tasks/1",
        payload: { status: "invalid_status" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PATCH /api/tasks/:id/move", () => {
    it("Happy Path : Déplacement", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1, status: "a_faire" });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
      (db.task.update as any).mockResolvedValue({ id: 1, status: "en_cours", position: 500 });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/tasks/1/move",
        payload: { status: "en_cours", position: 500 },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).status).toBe("en_cours");
    });

    it("Erreur 403 : Pas membre du projet", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [] });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/tasks/1/move",
        payload: { status: "en_cours", position: 500 },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("Happy Path : Suppression", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
      (db.task.delete as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/tasks/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });

    it("Erreur 404 : Tâche non trouvée", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.task.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "DELETE",
        url: "/api/tasks/999",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
