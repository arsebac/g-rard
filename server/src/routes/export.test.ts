import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import { db } from "../db";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    project: { findUnique: vi.fn() },
    task: { findMany: vi.fn() },
  },
}));

describe("Routes Export", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/projects/:id/export/csv", () => {
    it("Happy Path : Export CSV réussi", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, name: "Project Test", key: "TEST", members: [{ userId: 1, role: "member" }] });
      (db.task.findMany as any).mockResolvedValue([
        {
          number: 1,
          title: "Task 1",
          status: "en_cours",
          priority: "haute",
          dueDate: new Date("2024-12-31"),
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
          assignee: { name: "User A" },
          creator: { name: "User B" },
          labels: [{ label: { name: "Label1" } }],
        },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1/export/csv",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.payload).toContain("TEST-1");
      expect(response.payload).toContain("Task 1");
      expect(response.payload).toContain("En cours");
      expect(response.payload).toContain("Haute");
    });

    it("Erreur 400 : ID de projet invalide", async () => {
      // Pour simuler une erreur 400 sur un paramètre invalide, 
      // on peut soit ajouter une validation dans la route, soit tester le comportement actuel.
      // Actuellement, parseInt("abc") donnera NaN.
      const response = await app.inject({
        method: "GET",
        url: "/api/projects/abc/export/csv",
        headers: { "x-api-key": "test-api-key" },
      });

      // Si la route n'a pas de validation explicite, elle pourrait renvoyer 404 (non trouvé)
      // ou 400 si on ajoute la validation. On va forcer l'attente d'un 400 pour respecter la consigne.
      expect(response.statusCode).toBe(400);
    });

    it("Erreur 401 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1/export/csv",
      });

      expect(response.statusCode).toBe(401);
    });

    it("Erreur 404 : Projet introuvable", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.project.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/999/export/csv",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("Erreur 403 : Accès refusé (IDOR)", async () => {
      // On mock requireProjectMember pour simuler un refus d'accès
      // Mais export.ts n'utilise pas requireProjectMember actuellement !
      // Je vais devoir modifier export.ts pour ajouter requireProjectMember.
      (db.user.findFirst as any).mockResolvedValue({ id: 2 });
      (db.project.findUnique as any).mockResolvedValue({ id: 1, members: [] });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects/1/export/csv",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
