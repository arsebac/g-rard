import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { findUnique: vi.fn() },
    sprint: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import { db } from "../db";

// Sprint 3 lives in project 10, where the current user (id 1) holds `role`.
function memberOf(role: "admin" | "member" | "viewer" | null) {
  (db.sprint.findUnique as any).mockResolvedValue({ id: 3, projectId: 10 });
  (db.project.findUnique as any).mockResolvedValue({ id: 10, members: role ? [{ userId: 1, role }] : [] });
}

describe("Sprint routes access", () => {
  let app: FastifyInstance;
  const headers = { "x-api-key": "test-api-key" };

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (db.user.findFirst as any).mockResolvedValue({ id: 1 });
    (db.sprint.update as any).mockResolvedValue({ id: 3 });
    (db.sprint.delete as any).mockResolvedValue({ id: 3 });
  });

  it("non-member can neither edit nor delete a sprint", async () => {
    memberOf(null);
    expect((await app.inject({ method: "PATCH", url: "/api/sprints/3", payload: { name: "X" }, headers })).statusCode).toBe(403);
    expect((await app.inject({ method: "DELETE", url: "/api/sprints/3", headers })).statusCode).toBe(403);
    expect(db.sprint.update).not.toHaveBeenCalled();
    expect(db.sprint.delete).not.toHaveBeenCalled();
  });

  it("viewer is refused", async () => {
    memberOf("viewer");
    expect((await app.inject({ method: "DELETE", url: "/api/sprints/3", headers })).statusCode).toBe(403);
  });

  it("member can edit and delete", async () => {
    memberOf("member");
    expect((await app.inject({ method: "PATCH", url: "/api/sprints/3", payload: { name: "X" }, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: "/api/sprints/3", headers })).statusCode).toBe(200);
  });

  it("unknown sprint gives 404", async () => {
    (db.sprint.findUnique as any).mockResolvedValue(null);
    expect((await app.inject({ method: "DELETE", url: "/api/sprints/99", headers })).statusCode).toBe(404);
  });
});
