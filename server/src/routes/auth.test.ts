import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { db } from "../db";

vi.mock("../db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

describe("Routes Auth", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe("POST /api/auth/login", () => {
    it("Happy Path : Connexion réussie", async () => {
      const mockUser = { id: 1, name: "Test User", email: "test@example.com", passwordHash: "hashed", avatarUrl: null };
      (db.user.findUnique as any).mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "test@example.com", password: "password123" },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.email).toBe("test@example.com");
      expect(data.name).toBe("Test User");
    });

    it("Erreur 400 : Données invalides (email manquant)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { password: "password123" },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe("Données invalides");
    });

    it("Erreur 401 : Email incorrect", async () => {
      (db.user.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "wrong@example.com", password: "password123" },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload).error).toBe("Email ou mot de passe incorrect");
    });

    it("Erreur 401 : Mot de passe incorrect", async () => {
      const mockUser = { id: 1, name: "Test User", email: "test@example.com", passwordHash: "hashed" };
      (db.user.findUnique as any).mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "test@example.com", password: "wrongpassword" },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload).error).toBe("Email ou mot de passe incorrect");
    });
  });

  describe("POST /api/auth/register", () => {
    it("Happy Path : Inscription réussie", async () => {
      (db.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue("hashed_new");
      (db.user.create as any).mockResolvedValue({
        id: 2,
        name: "New User",
        email: "new@example.com",
        avatarUrl: null,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "New User", email: "new@example.com", password: "securepassword" },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).name).toBe("New User");
    });

    it("Erreur 400 : Données invalides (password trop court)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "New User", email: "new@example.com", password: "123" },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe("Données invalides");
    });

    it("Erreur 409 : Email déjà utilisé", async () => {
      (db.user.findUnique as any).mockResolvedValue({ id: 1, email: "exists@example.com" });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Test User", email: "exists@example.com", password: "password123" },
      });

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.payload).error).toBe("Cet email est déjà utilisé");
    });
  });

  describe("GET /api/auth/me", () => {
    it("Happy Path : Récupérer mon profil via API Key", async () => {
      const mockUser = { id: 1, name: "Test User", email: "test@example.com", avatarUrl: null };
      (db.user.findFirst as any).mockResolvedValue(mockUser);
      (db.user.findUnique as any).mockResolvedValue(mockUser);

      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { "x-api-key": "test-api-key" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).email).toBe("test@example.com");
    });

    it("Erreur 401 : Non authentifié", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload).error).toBe("Non authentifié");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("Happy Path : Déconnexion réussie", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });
  });
});
