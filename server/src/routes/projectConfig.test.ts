import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { findUnique: vi.fn() },
    projectColumn: { count: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    workflowTransition: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));

import { db } from "../db";

// The current user (id 1) holds `role` on project 10.
function memberOf(role: "admin" | "member" | "viewer" | null) {
  (db.project.findUnique as any).mockResolvedValue({ id: 10, members: role ? [{ userId: 1, role }] : [] });
}

describe("Project columns and workflow access", () => {
  let app: FastifyInstance;
  const headers = { "x-api-key": "test-api-key" };
  const reads = [
    { method: "GET", url: "/api/projects/10/columns" },
    { method: "GET", url: "/api/projects/10/workflow" },
  ] as const;
  const writes = [
    { method: "PATCH", url: "/api/projects/10/columns/a_faire", payload: { label: "Todo" } },
    { method: "PATCH", url: "/api/projects/10/columns/reorder", payload: { order: ["a_faire"] } },
    { method: "PUT", url: "/api/projects/10/workflow", payload: { transitions: [] } },
  ] as const;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (db.user.findFirst as any).mockResolvedValue({ id: 1 });
    (db.projectColumn.count as any).mockResolvedValue(4);
    (db.projectColumn.findMany as any).mockResolvedValue([]);
    (db.projectColumn.update as any).mockResolvedValue({});
    (db.workflowTransition.findMany as any).mockResolvedValue([]);
    (db.workflowTransition.deleteMany as any).mockResolvedValue({ count: 0 });
  });

  it("non-member is refused on all 5 routes", async () => {
    memberOf(null);
    for (const call of [...reads, ...writes]) {
      const response = await app.inject({ ...call, headers } as any);
      expect(response.statusCode, `${call.method} ${call.url}`).toBe(403);
    }
    expect(db.projectColumn.update).not.toHaveBeenCalled();
    expect(db.workflowTransition.deleteMany).not.toHaveBeenCalled();
  });

  it("viewer can read but not write", async () => {
    memberOf("viewer");
    for (const call of reads) {
      expect((await app.inject({ ...call, headers } as any)).statusCode, call.url).toBe(200);
    }
    for (const call of writes) {
      expect((await app.inject({ ...call, headers } as any)).statusCode, `${call.method} ${call.url}`).toBe(403);
    }
  });

  it("member can write", async () => {
    memberOf("member");
    for (const call of writes) {
      expect((await app.inject({ ...call, headers } as any)).statusCode, `${call.method} ${call.url}`).toBe(200);
    }
  });

  it("non-numeric project id gives 400", async () => {
    const response = await app.inject({ method: "GET", url: "/api/projects/abc/columns", headers });
    expect(response.statusCode).toBe(400);
  });
});
