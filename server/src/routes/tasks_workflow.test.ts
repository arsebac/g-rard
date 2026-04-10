import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import { db } from "../db";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { findUnique: vi.fn(), findFirst: vi.fn() },
    task: { 
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workflowTransition: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../config", () => ({
  config: {
    apiKey: "test-api-key",
    sessionSecret: "a-very-secret-key-that-is-at-least-32-characters-long",
    uploadDir: "./uploads",
    isDev: true,
    port: 3000,
  },
}));

vi.mock("../services/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

describe("Workflow Validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("should fail to move task if transition is not allowed by workflow", async () => {
    (db.user.findFirst as any).mockResolvedValue({ id: 1 });
    (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1, status: "a_faire" });
    (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
    
    // Define a workflow that ONLY allows a_faire -> en_cours
    (db.workflowTransition.findMany as any).mockResolvedValue([
      { fromStatus: "a_faire", toStatus: "en_cours" }
    ]);

    // Try to move to "termine"
    const response = await app.inject({
      method: "PATCH",
      url: "/api/tasks/1/move",
      payload: { status: "termine", position: 500 },
      headers: { "x-api-key": "test-api-key" }
    });

    // Currently it returns 200 because validation is NOT enforced
    // Once implemented, it should return 400 or 403
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload).error).toContain("Transition non autorisée");
  });

  it("should allow move task if transition is allowed by workflow", async () => {
    (db.user.findFirst as any).mockResolvedValue({ id: 1 });
    (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1, status: "a_faire" });
    (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
    
    // Define a workflow that allows a_faire -> en_cours
    (db.workflowTransition.findMany as any).mockResolvedValue([
      { fromStatus: "a_faire", toStatus: "en_cours" }
    ]);
    (db.task.update as any).mockResolvedValue({ id: 1, status: "en_cours", position: 500 });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/tasks/1/move",
      payload: { status: "en_cours", position: 500 },
      headers: { "x-api-key": "test-api-key" }
    });

    expect(response.statusCode).toBe(200);
  });

  it("should allow move task if no workflow is defined", async () => {
    (db.user.findFirst as any).mockResolvedValue({ id: 1 });
    (db.task.findUnique as any).mockResolvedValue({ id: 1, projectId: 1, status: "a_faire" });
    (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [{ userId: 1, role: "member" }] });
    
    // No transitions defined
    (db.workflowTransition.findMany as any).mockResolvedValue([]);
    (db.task.update as any).mockResolvedValue({ id: 1, status: "termine", position: 500 });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/tasks/1/move",
      payload: { status: "termine", position: 500 },
      headers: { "x-api-key": "test-api-key" }
    });

    expect(response.statusCode).toBe(200);
  });
});
