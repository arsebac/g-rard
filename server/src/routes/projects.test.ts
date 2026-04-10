import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";

// Mocking complet de Prisma
vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { findUnique: vi.fn() },
    projectColumn: { findMany: vi.fn(), createMany: vi.fn() },
    workflowTransition: { findMany: vi.fn() },
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

import { db } from "../db";

describe("Intégration : Isolation des Projets (IDOR)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("L'utilisateur 1 doit pouvoir accéder à son projet privé via API Key", async () => {
    const mockProject = {
      id: 1,
      name: "Secret User 1",
      isPublic: false,
      members: [{ userId: 1, role: "admin" }],
      columns: [],
      workflowTransitions: [],
      _count: { tasks: 0 }
    };

    (db.user.findFirst as any).mockResolvedValue({ id: 1, name: "Admin" });
    (db.project.findUnique as any).mockResolvedValue(mockProject);

    const response = await app.inject({
      method: "GET",
      url: "/api/projects/1",
      headers: { "x-api-key": "test-api-key" }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.name).toBe("Secret User 1");
  });

  it("Un accès doit être refusé si l'utilisateur n'est pas authentifié", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/projects/1",
    });

    expect(response.statusCode).toBe(401);
  });
});
