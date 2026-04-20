import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import { db } from "../db";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { findUnique: vi.fn() },
    recurringTask: { 
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ maxNumber: 10 }]),
    $transaction: vi.fn((cb) => cb(db)),
  },
}));

vi.mock("../services/recurringTaskGenerator", () => ({
  generateOccurrences: vi.fn().mockResolvedValue(undefined),
}));

describe("Routes Recurring Tasks", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const mockUser = { id: 1, name: "Test User" };
  const mockProject = { 
    id: 1, 
    members: [{ userId: 1, role: "admin" }],
    isPublic: false
  };

  describe("GET /api/projects/:projectId/recurring-tasks", () => {
    it("should return list of templates for a project", async () => {
      (db.user.findFirst as any).mockResolvedValue(mockUser);
      (db.project.findUnique as any).mockResolvedValue(mockProject);
      (db.recurringTask.findMany as any).mockResolvedValue([{ id: 1, title: "Template 1" }]);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1/recurring-tasks",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });
  });

  describe("POST /api/projects/:projectId/recurring-tasks", () => {
    it("should create a new template", async () => {
      (db.user.findFirst as any).mockResolvedValue(mockUser);
      (db.project.findUnique as any).mockResolvedValue(mockProject);
      const newTemplate = { id: 1, title: "New Recurring", recurrenceType: "EVERY_N_WEEKS" };
      (db.recurringTask.create as any).mockResolvedValue(newTemplate);
      (db.recurringTask.findUnique as any).mockResolvedValue(newTemplate);

      const response = await app.inject({
        method: "POST",
        url: "/api/projects/1/recurring-tasks",
        headers: { "x-api-key": "test-api-key" },
        payload: {
          title: "New Recurring",
          recurrenceType: "EVERY_N_WEEKS",
          intervalWeeks: 2
        }
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).title).toBe("New Recurring");
    });

    it("should return 400 for invalid data", async () => {
      (db.user.findFirst as any).mockResolvedValue(mockUser);
      (db.project.findUnique as any).mockResolvedValue(mockProject);

      const response = await app.inject({
        method: "POST",
        url: "/api/projects/1/recurring-tasks",
        headers: { "x-api-key": "test-api-key" },
        payload: {
          title: "", // Empty title invalid
          recurrenceType: "INVALID"
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/recurring-tasks/:id", () => {
    it("should return a single template", async () => {
      (db.user.findFirst as any).mockResolvedValue(mockUser);
      (db.recurringTask.findUnique as any).mockResolvedValue({ id: 1, projectId: 1, title: "T1" });
      (db.project.findUnique as any).mockResolvedValue(mockProject);

      const response = await app.inject({
        method: "GET",
        url: "/api/recurring-tasks/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).id).toBe(1);
    });

    it("should return 404 if not found", async () => {
      (db.user.findFirst as any).mockResolvedValue(mockUser);
      (db.recurringTask.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/recurring-tasks/999",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/recurring-tasks/:id", () => {
    it("should update a template", async () => {
      (db.user.findFirst as any).mockResolvedValue(mockUser);
      const existing = { id: 1, projectId: 1, title: "Old Title" };
      (db.recurringTask.findUnique as any).mockResolvedValue(existing);
      (db.project.findUnique as any).mockResolvedValue(mockProject);
      (db.recurringTask.update as any).mockResolvedValue({ ...existing, title: "New Title" });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/recurring-tasks/1",
        headers: { "x-api-key": "test-api-key" },
        payload: { title: "New Title" }
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/recurring-tasks/:id", () => {
    it("should delete a template", async () => {
      (db.user.findFirst as any).mockResolvedValue(mockUser);
      (db.recurringTask.findUnique as any).mockResolvedValue({ id: 1, projectId: 1 });
      (db.project.findUnique as any).mockResolvedValue(mockProject);
      (db.task.deleteMany as any).mockResolvedValue({ count: 1 });
      (db.task.updateMany as any).mockResolvedValue({ count: 1 });
      (db.recurringTask.delete as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/recurring-tasks/1",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).success).toBe(true);
    });
  });
});
