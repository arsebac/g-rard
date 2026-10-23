import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { Readable } from "stream";

// Mocking Prisma
vi.mock("../db", () => ({
  db: {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mocking Bcrypt
vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// Mocking Storage Service
vi.mock("../services/storage", () => ({
  storageService: {
    saveFile: vi.fn().mockResolvedValue("path/to/avatar.png"),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    getStream: vi.fn(() => Readable.from([Buffer.from("PNGDATA")])),
  },
}));

import { db } from "../db";
import { storageService } from "../services/storage";

function multipartFile(filename: string, contentType: string) {
  const boundary = "----gerardtest";
  const body =
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n<script>alert(1)</script>\r\n--${boundary}--\r\n`;
  return { payload: body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("Routes Users", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("GET /api/users", () => {
    it("Happy Path : Liste des utilisateurs", async () => {
      const mockUsers = [
        { id: 1, name: "User 1", email: "u1@ex.com", avatarUrl: null },
        { id: 2, name: "User 2", email: "u2@ex.com", avatarUrl: null },
      ];

      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.user.findMany as any).mockResolvedValue(mockUsers);

      const response = await app.inject({
        method: "GET",
        url: "/api/users",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
    });

    it("Edge case 2 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/users",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PATCH /api/users/:id", () => {
    it("Happy Path : Mise à jour réussie", async () => {
      const updatedUser = { id: 1, name: "Updated Name", email: "u1@ex.com", avatarUrl: null };

      (db.user.findFirst as any).mockResolvedValue({ id: 1 }); // Auth
      (db.user.update as any).mockResolvedValue(updatedUser);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/1",
        payload: { name: "Updated Name" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).name).toBe("Updated Name");
    });

    it("Edge case 1 : Validation d'entrée (Body invalide)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/1",
        payload: { name: "" }, // min(1)
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(400);
    });

    it("Edge case 2 : IDOR (Pas le même utilisateur)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/2", // On essaie de modifier l'user 2 en étant l'user 1
        payload: { name: "Hacked" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PATCH /api/users/:id/password", () => {
    it("Happy Path : Changement de mot de passe", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.user.findUnique as any).mockResolvedValue({ id: 1, passwordHash: "old_hash" });
      (bcrypt.compare as any).mockResolvedValue(true);
      (bcrypt.hash as any).mockResolvedValue("new_hash");

      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/1/password",
        payload: { currentPassword: "old", newPassword: "newpassword" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });

    it("Edge case 2 : Mot de passe actuel incorrect", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.user.findUnique as any).mockResolvedValue({ id: 1, passwordHash: "old_hash" });
      (bcrypt.compare as any).mockResolvedValue(false);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/1/password",
        payload: { currentPassword: "wrong", newPassword: "newpassword" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(401);
    });

    it("Edge case 3 : Utilisateur introuvable (404)", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.user.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/1/password",
        payload: { currentPassword: "old", newPassword: "newpassword" },
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/users/me/avatar", () => {
    // Le test d'upload est un peu plus complexe à cause de multipart/form-data
    // Mais on peut mocker req.file() si on veut rester simple, 
    // ou utiliser app.inject avec boundary (mais fastify-multipart doit être bien configuré)
    
    it("Edge case 1 : Fichier manquant", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      
      const response = await app.inject({
        method: "POST",
        url: "/api/users/me/avatar",
        headers: { "x-api-key": "test-api-key" }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("Uploaded files are not public", () => {
    const headers = { "x-api-key": "test-api-key" };

    it("GET /uploads/* is no longer served", async () => {
      const response = await app.inject({ method: "GET", url: "/uploads/2026/10/anything.html" });
      expect(response.statusCode).toBe(404);
    });

    it("refuses a non-image avatar", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (storageService.saveFile as any).mockClear();
      for (const [name, type] of [["x.html", "text/html"], ["x.svg", "image/svg+xml"], ["x.png", "text/html"]]) {
        const file = multipartFile(name, type);
        const response = await app.inject({
          method: "POST", url: "/api/users/me/avatar", payload: file.payload,
          headers: { ...headers, ...file.headers },
        });
        expect(response.statusCode, name).toBe(400);
      }
      expect(storageService.saveFile).not.toHaveBeenCalled();
    });

    it("GET /api/users/:id/avatar requires a session", async () => {
      const response = await app.inject({ method: "GET", url: "/api/users/1/avatar" });
      expect(response.statusCode).toBe(401);
    });

    it("GET /api/users/:id/avatar serves the stored image with its type", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.user.findUnique as any).mockResolvedValue({ avatarUrl: "2026/10/abc.png" });
      const response = await app.inject({ method: "GET", url: "/api/users/1/avatar", headers });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/png");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("GET /api/users/:id/avatar gives 404 without an avatar", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.user.findUnique as any).mockResolvedValue({ avatarUrl: null });
      const response = await app.inject({ method: "GET", url: "/api/users/2/avatar", headers });
      expect(response.statusCode).toBe(404);
    });
  });
});
