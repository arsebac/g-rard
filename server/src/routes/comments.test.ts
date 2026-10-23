import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import { db } from "../db";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    task: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    comment: { 
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    activityLog: { findMany: vi.fn() },
  },
}));

vi.mock("../services/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Task 1 lives in project 10, where the current user (id 1) holds `role`.
function memberOf(role: "admin" | "member" | "viewer" | null) {
  (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 10 });
  (db.project.findUnique as any).mockResolvedValue({ id: 10, members: role ? [{ userId: 1, role }] : [] });
}

describe("Routes Comments", () => {
  let app: FastifyInstance;

  beforeEach(() => memberOf("member"));

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/tasks/:taskId/comments", () => {
    it("Happy Path : Liste des commentaires", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.comment.findMany as any).mockResolvedValue([
        { id: 1, body: "Cool", author: { id: 1, name: "User" } }
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/1/comments",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });

    it("Erreur 401 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/1/comments",
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/tasks/:taskId/comments", () => {
    it("Happy Path : Ajout de commentaire", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.comment.create as any).mockResolvedValue({ 
        id: 1, 
        body: "New comment", 
        author: { id: 1, name: "User" } 
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks/1/comments",
        payload: { body: "New comment" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).body).toBe("New comment");
    });

    it("Erreur 400 : Corps vide", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks/1/comments",
        payload: { body: "" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PATCH /api/comments/:id", () => {
    it("Happy Path : Modification réussie", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.comment.findUnique as any).mockResolvedValue({ id: 1, authorId: 1 });
      (db.comment.update as any).mockResolvedValue({ 
        id: 1, 
        body: "Updated", 
        author: { id: 1, name: "User" } 
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/comments/1",
        payload: { body: "Updated" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).body).toBe("Updated");
    });

    it("Erreur 403 : Pas l'auteur", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.comment.findUnique as any).mockResolvedValue({ id: 1, authorId: 2 });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/comments/1",
        payload: { body: "Updated" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(403);
    });

    it("Erreur 404 : Commentaire introuvable", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.comment.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/comments/999",
        payload: { body: "Updated" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/comments/:id", () => {
    it("Happy Path : Suppression réussie", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.comment.findUnique as any).mockResolvedValue({ id: 1, authorId: 1, taskId: 1 });
      (db.comment.delete as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/comments/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });

    it("Erreur 403 : Pas l'auteur", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.comment.findUnique as any).mockResolvedValue({ id: 1, authorId: 2, taskId: 1 });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/comments/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/tasks/:taskId/activity", () => {
    it("Happy Path : Liste de l'activité", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.activityLog.findMany as any).mockResolvedValue([
        { id: 1, action: "task_created", actor: { id: 1, name: "User" } }
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks/1/activity",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });
  });

  describe("Project access", () => {
    const headers = { "x-api-key": "test-api-key" };

    beforeEach(() => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.comment.create as any).mockClear();
    });

    it("non-member can neither read nor comment", async () => {
      memberOf(null);
      expect((await app.inject({ method: "GET", url: "/api/tasks/1/comments", headers })).statusCode).toBe(403);
      expect((await app.inject({ method: "GET", url: "/api/tasks/1/activity", headers })).statusCode).toBe(403);
      expect((await app.inject({ method: "POST", url: "/api/tasks/1/comments", payload: { body: "hi" }, headers })).statusCode).toBe(403);
      expect(db.comment.create).not.toHaveBeenCalled();
    });

    it("viewer can read but not comment", async () => {
      memberOf("viewer");
      (db.comment.findMany as any).mockResolvedValue([]);
      expect((await app.inject({ method: "GET", url: "/api/tasks/1/comments", headers })).statusCode).toBe(200);
      expect((await app.inject({ method: "POST", url: "/api/tasks/1/comments", payload: { body: "hi" }, headers })).statusCode).toBe(403);
    });

    it("unknown task gives 404", async () => {
      (db.task.findUnique as any).mockResolvedValue(null);
      expect((await app.inject({ method: "GET", url: "/api/tasks/999/comments", headers })).statusCode).toBe(404);
    });
  });
});
