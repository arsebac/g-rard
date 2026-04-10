import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
    task: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from "../db";

describe("Search Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/search", () => {
    it("Happy Path : Recherche réussie (SQL Raw)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.$queryRaw as any).mockResolvedValue([
        { 
          id: 1, 
          project_id: 10, 
          number: 1, 
          title: "Test Task", 
          status: "open", 
          priority: "high",
          project_key: "TEST",
          project_name: "Project Test",
          project_color: "#ff0000"
        }
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/search",
        query: { q: "test" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveLength(1);
      expect(payload[0].title).toBe("Test Task");
    });

    it("Happy Path : Fallback Recherche (Prisma findMany)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.$queryRaw as any).mockRejectedValue(new Error("Index not ready"));
      (db.task.findMany as any).mockResolvedValue([
        {
          id: 2,
          projectId: 10,
          number: 2,
          title: "Fallback Task",
          status: "open",
          priority: "low",
          project: { key: "TEST", name: "Project Test", color: "#ff0000" }
        }
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/search",
        query: { q: "fallback" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)[0].title).toBe("Fallback Task");
    });

    it("Cas : Requête trop courte (Validation)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      const response = await app.inject({
        method: "GET",
        url: "/api/search",
        query: { q: "a" },
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(0);
    });

    it("Erreur 401 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/search",
        query: { q: "test" },
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
