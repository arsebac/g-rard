import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import { db } from "../db";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    task: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    label: { 
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    taskLabel: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// The current user (id 1) holds `role` on project 1. Task 1 and label 1 live there.
function memberOf(role: "admin" | "member" | "viewer" | null) {
  (db.project.findUnique as any).mockResolvedValue({ id: 1, members: role ? [{ userId: 1, role }] : [] });
  (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
  (db.label.findUnique as any).mockResolvedValue({ id: 1, projectId: 1, name: "Bug", color: "#ff0000" });
}

describe("Routes Labels", () => {
  let app: FastifyInstance;

  beforeEach(() => memberOf("member"));

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/projects/:id/labels", () => {
    it("Happy Path : Liste des labels d'un projet", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.label.findMany as any).mockResolvedValue([{ id: 1, name: "Bug", color: "#ff0000" }]);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1/labels",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });

    it("Erreur 401 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1/labels",
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/projects/:id/labels", () => {
    it("Happy Path : Création d'un label", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.label.create as any).mockResolvedValue({ id: 1, name: "Bug", color: "#ff0000" });

      const response = await app.inject({
        method: "POST",
        url: "/api/projects/1/labels",
        payload: { name: "Bug", color: "#ff0000" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).name).toBe("Bug");
    });

    it("Erreur 400 : Couleur invalide", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "POST",
        url: "/api/projects/1/labels",
        payload: { name: "Bug", color: "red" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PATCH /api/labels/:id", () => {
    it("Happy Path : Mise à jour d'un label", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.label.update as any).mockResolvedValue({ id: 1, name: "Fix", color: "#00ff00" });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/labels/1",
        payload: { name: "Fix" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).name).toBe("Fix");
    });

    it("Erreur 400 : Données invalides", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/labels/1",
        payload: { color: "invalid" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/labels/:id", () => {
    it("Happy Path : Suppression d'un label", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.label.delete as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/labels/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });
  });

  describe("POST /api/tasks/:id/labels/:labelId", () => {
    it("Happy Path : Assignation d'un label à une tâche", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.taskLabel.upsert as any).mockResolvedValue({ taskId: 1, labelId: 1 });

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks/1/labels/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });
  });

  describe("DELETE /api/tasks/:id/labels/:labelId", () => {
    it("Happy Path : Désassignation d'un label", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.taskLabel.deleteMany as any).mockResolvedValue({ count: 1 });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/tasks/1/labels/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });
  });

  describe("Project access", () => {
    const headers = { "x-api-key": "test-api-key" };
    const writes = [
      { method: "POST", url: "/api/projects/1/labels", payload: { name: "X", color: "#000000" } },
      { method: "PATCH", url: "/api/labels/1", payload: { name: "X" } },
      { method: "DELETE", url: "/api/labels/1" },
      { method: "POST", url: "/api/tasks/1/labels/1" },
      { method: "DELETE", url: "/api/tasks/1/labels/1" },
    ] as const;

    beforeEach(() => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      for (const fn of [db.label.create, db.label.update, db.label.delete, db.taskLabel.upsert, db.taskLabel.deleteMany]) {
        (fn as any).mockClear();
      }
    });

    it("non-member is refused on all 6 routes", async () => {
      memberOf(null);
      for (const call of [{ method: "GET", url: "/api/projects/1/labels" }, ...writes]) {
        const response = await app.inject({ ...call, headers } as any);
        expect(response.statusCode, `${call.method} ${call.url}`).toBe(403);
      }
      expect(db.label.create).not.toHaveBeenCalled();
      expect(db.label.update).not.toHaveBeenCalled();
      expect(db.label.delete).not.toHaveBeenCalled();
      expect(db.taskLabel.upsert).not.toHaveBeenCalled();
      expect(db.taskLabel.deleteMany).not.toHaveBeenCalled();
    });

    it("viewer can list but not write", async () => {
      memberOf("viewer");
      (db.label.findMany as any).mockResolvedValue([]);
      expect((await app.inject({ method: "GET", url: "/api/projects/1/labels", headers })).statusCode).toBe(200);
      for (const call of writes) {
        const response = await app.inject({ ...call, headers } as any);
        expect(response.statusCode, `${call.method} ${call.url}`).toBe(403);
      }
    });

    it("refuses a label from another project than the task's", async () => {
      memberOf("member");
      (db.label.findUnique as any).mockResolvedValue({ id: 2, projectId: 99 });
      const response = await app.inject({ method: "POST", url: "/api/tasks/1/labels/2", headers });
      expect(response.statusCode).toBe(400);
      expect(db.taskLabel.upsert).not.toHaveBeenCalled();
    });
  });
});
