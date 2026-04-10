import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import { db } from "../db";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    label: { 
      findMany: vi.fn(),
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

describe("Routes Labels", () => {
  let app: FastifyInstance;

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
});
