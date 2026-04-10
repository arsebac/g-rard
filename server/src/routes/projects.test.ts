import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";

// Mocking complet de Prisma
vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { 
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    projectColumn: { findMany: vi.fn(), createMany: vi.fn() },
    workflowTransition: { findMany: vi.fn() },
    activityLog: { findMany: vi.fn() },
  },
}));

// Mocking partiel du service de colonnes
vi.mock("./projectColumns", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    ensureDefaultColumns: vi.fn().mockResolvedValue(true),
  };
});

// Mocking activity service
vi.mock("../services/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "../db";

describe("Routes Projets", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/projects", () => {
    it("Happy Path : Liste des projets", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findMany as any).mockResolvedValue([{ id: 1, name: "P1" }]);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });

    it("Edge case 2 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/projects", () => {
    it("Happy Path : Création réussie", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.create as any).mockResolvedValue({ id: 1, name: "New Project", key: "NP" });

      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "New Project", key: "NP" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).name).toBe("New Project");
    });

    it("Edge case 1 : Validation d'entrée (Key invalide)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "New Project", key: "invalid-key" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("Happy Path : Détails du projet", async () => {
      const mockProject = {
        id: 1,
        name: "P1",
        isPublic: true,
        members: [{ userId: 1, role: "admin" }],
        _count: { tasks: 0 }
      };

      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(mockProject);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).name).toBe("P1");
    });

    it("Edge case 3 : Projet introuvable", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/999",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/projects/:id", () => {
    it("Happy Path : Mise à jour réussie", async () => {
      const mockProject = {
        id: 1,
        name: "P1",
        isPublic: true,
        members: [{ userId: 1, role: "admin" }],
      };

      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(mockProject);
      (db.project.update as any).mockResolvedValue({ ...mockProject, name: "Updated" });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/projects/1",
        payload: { name: "Updated" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).name).toBe("Updated");
    });

    it("Edge case 2 : Accès refusé (Pas admin)", async () => {
      const mockProject = {
        id: 1,
        name: "P1",
        isPublic: true,
        members: [{ userId: 1, role: "member" }], // Pas admin
      };

      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(mockProject);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/projects/1",
        payload: { name: "Updated" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("Happy Path : Archivage réussi", async () => {
      const mockProject = {
        id: 1,
        name: "P1",
        isPublic: true,
        members: [{ userId: 1, role: "admin" }],
      };

      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(mockProject);
      (db.project.update as any).mockResolvedValue({ ...mockProject, status: "archive" });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/projects/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });
  });
});
