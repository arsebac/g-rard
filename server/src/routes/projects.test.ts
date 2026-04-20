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
    projectMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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

    it("Edge case 2 : Duplicate key error (P2002)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      const error = new Error("Unique constraint failed") as any;
      error.code = "P2002";
      error.meta = { target: ["key"] };
      (db.project.create as any).mockRejectedValue(error);

      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Duplicate", key: "DUP" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.payload).error).toBe("A project with this key already exists");
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

  // ─── Member management ──────────────────────────────────────────────────────

  const adminProject = { id: 1, isPublic: false, members: [{ userId: 1, role: "admin" }] };
  const memberProject = { id: 1, isPublic: false, members: [{ userId: 1, role: "member" }] };
  const viewerProject = { id: 1, isPublic: false, members: [{ userId: 1, role: "viewer" }] };

  describe("GET /api/projects/:id/members", () => {
    it("returns member list for any project member", async () => {
      const mockMembers = [
        { userId: 1, role: "admin", user: { id: 1, name: "Alice", avatarUrl: null } },
        { userId: 2, role: "member", user: { id: 2, name: "Bob", avatarUrl: null } },
      ];
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findMany as any).mockResolvedValue(mockMembers);

      const res = await app.inject({
        method: "GET",
        url: "/api/projects/1/members",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(2);
    });

    it("returns member list for viewer (read-only access)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(viewerProject);
      (db.projectMember.findMany as any).mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: "/api/projects/1/members",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns 403 for non-member on private project", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, isPublic: false, members: [] });

      const res = await app.inject({
        method: "GET",
        url: "/api/projects/1/members",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("POST /api/projects/:id/members", () => {
    it("admin can add a new member", async () => {
      const newMember = { userId: 2, role: "member", user: { id: 2, name: "Bob", avatarUrl: null } };
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(null); // not yet a member
      (db.projectMember.create as any).mockResolvedValue(newMember);

      const res = await app.inject({
        method: "POST",
        url: "/api/projects/1/members",
        headers: { "x-api-key": "test-api-key" },
        payload: { userId: 2, role: "member" },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload).role).toBe("member");
    });

    it("admin can add a viewer", async () => {
      const newMember = { userId: 3, role: "viewer", user: { id: 3, name: "Carol", avatarUrl: null } };
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(null);
      (db.projectMember.create as any).mockResolvedValue(newMember);

      const res = await app.inject({
        method: "POST",
        url: "/api/projects/1/members",
        headers: { "x-api-key": "test-api-key" },
        payload: { userId: 3, role: "viewer" },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload).role).toBe("viewer");
    });

    it("returns 409 when user is already a member", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue({ userId: 2, role: "member" });

      const res = await app.inject({
        method: "POST",
        url: "/api/projects/1/members",
        headers: { "x-api-key": "test-api-key" },
        payload: { userId: 2, role: "member" },
      });

      expect(res.statusCode).toBe(409);
    });

    it("returns 403 when caller is not admin", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(memberProject);

      const res = await app.inject({
        method: "POST",
        url: "/api/projects/1/members",
        headers: { "x-api-key": "test-api-key" },
        payload: { userId: 2, role: "member" },
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns 400 for invalid role value", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);

      const res = await app.inject({
        method: "POST",
        url: "/api/projects/1/members",
        headers: { "x-api-key": "test-api-key" },
        payload: { userId: 2, role: "superadmin" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /api/projects/:id/members/:userId", () => {
    it("admin can change a member's role", async () => {
      const existing = { userId: 2, role: "member", projectId: 1 };
      const updated = { userId: 2, role: "admin", user: { id: 2, name: "Bob", avatarUrl: null } };
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(existing);
      (db.projectMember.update as any).mockResolvedValue(updated);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/projects/1/members/2",
        headers: { "x-api-key": "test-api-key" },
        payload: { role: "admin" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).role).toBe("admin");
    });

    it("returns 400 when demoting the last admin", async () => {
      const existing = { userId: 1, role: "admin", projectId: 1 };
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(existing);
      (db.projectMember.count as any).mockResolvedValue(1); // only 1 admin

      const res = await app.inject({
        method: "PATCH",
        url: "/api/projects/1/members/1",
        headers: { "x-api-key": "test-api-key" },
        payload: { role: "member" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toMatch(/last admin/i);
    });

    it("allows demoting an admin when another admin exists", async () => {
      const existing = { userId: 2, role: "admin", projectId: 1 };
      const updated = { userId: 2, role: "member", user: { id: 2, name: "Bob", avatarUrl: null } };
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(existing);
      (db.projectMember.count as any).mockResolvedValue(2); // 2 admins
      (db.projectMember.update as any).mockResolvedValue(updated);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/projects/1/members/2",
        headers: { "x-api-key": "test-api-key" },
        payload: { role: "member" },
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns 404 when member does not exist", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/projects/1/members/99",
        headers: { "x-api-key": "test-api-key" },
        payload: { role: "member" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when caller is not admin", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(memberProject);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/projects/1/members/2",
        headers: { "x-api-key": "test-api-key" },
        payload: { role: "viewer" },
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns 403 when caller is a viewer", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(viewerProject);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/projects/1/members/2",
        headers: { "x-api-key": "test-api-key" },
        payload: { role: "member" },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/projects/:id/members/:userId", () => {
    it("admin can remove a member", async () => {
      const existing = { userId: 2, role: "member", projectId: 1 };
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(existing);
      (db.projectMember.delete as any).mockResolvedValue(existing);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/projects/1/members/2",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).ok).toBe(true);
    });

    it("returns 400 when removing the last admin", async () => {
      const existing = { userId: 1, role: "admin", projectId: 1 };
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(existing);
      (db.projectMember.count as any).mockResolvedValue(1);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/projects/1/members/1",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toMatch(/last admin/i);
    });

    it("allows removing an admin when another admin exists", async () => {
      const existing = { userId: 2, role: "admin", projectId: 1 };
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(existing);
      (db.projectMember.count as any).mockResolvedValue(2);
      (db.projectMember.delete as any).mockResolvedValue(existing);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/projects/1/members/2",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns 404 when member does not exist", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(adminProject);
      (db.projectMember.findUnique as any).mockResolvedValue(null);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/projects/1/members/99",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when caller is not admin", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(memberProject);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/projects/1/members/2",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
