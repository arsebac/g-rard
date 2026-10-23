import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { db } from "../db";
import { config } from "../config";
import { hashMcpToken } from "../services/mcpAuth";

vi.mock("../db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
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
    it("Happy Path: Successful login", async () => {
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

    it("Error 400: Invalid data (missing email)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { password: "password123" },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe("Invalid data");
    });

    it("Error 401: Incorrect email", async () => {
      (db.user.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "wrong@example.com", password: "password123" },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload).error).toBe("Incorrect email or password");
    });

    it("Error 401: Incorrect password", async () => {
      const mockUser = { id: 1, name: "Test User", email: "test@example.com", passwordHash: "hashed" };
      (db.user.findUnique as any).mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "test@example.com", password: "wrongpassword" },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload).error).toBe("Incorrect email or password");
    });
  });

  describe("POST /api/auth/register", () => {
    beforeEach(() => {
      config.allowRegistration = true;
    });

    afterEach(() => {
      config.allowRegistration = false;
    });

    it("Error 403: registration disabled by default", async () => {
      config.allowRegistration = false;
      (db.user.create as any).mockClear();
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Eve", email: "eve@example.com", password: "password123" },
      });
      expect(response.statusCode).toBe(403);
      expect(db.user.create).not.toHaveBeenCalled();
      const cfg = await app.inject({ method: "GET", url: "/api/auth/config" });
      expect(JSON.parse(cfg.payload)).toEqual({ registration: false });
    });

    it("Happy Path: Successful registration", async () => {
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

    it("Error 400: Invalid data (password too short)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "New User", email: "new@example.com", password: "123" },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe("Invalid data");
    });

    it("Error 409: Email already in use", async () => {
      (db.user.findUnique as any).mockResolvedValue({ id: 1, email: "exists@example.com" });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Test User", email: "exists@example.com", password: "password123" },
      });

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.payload).error).toBe("This email is already in use");
    });
  });

  describe("GET /api/auth/me", () => {
    it("Happy Path: Get my profile via API Key", async () => {
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

    it("Error 401: Not authenticated", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload).error).toBe("Not authenticated");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("Happy Path: Successful logout", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).ok).toBe(true);
    });
  });


  describe("Login rate limit", () => {
    const attempt = (email: string) =>
      app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: "wrong" } });

    it("blocks the 11th attempt on the same account within a minute", async () => {
      (db.user.findUnique as any).mockResolvedValue(null);
      for (let i = 0; i < 10; i++) {
        expect((await attempt("Victim@Example.com")).statusCode).toBe(401);
      }
      expect((await attempt("victim@example.com")).statusCode).toBe(429);
    });

    it("does not throttle another account", async () => {
      (db.user.findUnique as any).mockResolvedValue(null);
      expect((await attempt("other@example.com")).statusCode).toBe(401);
    });
  });

  describe("MCP token", () => {
    const headers = { "x-api-key": "test-api-key" };

    it("GET only tells whether a token exists", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.user.findUnique as any).mockResolvedValue({ mcpTokenHash: "a".repeat(64) });
      const response = await app.inject({ method: "GET", url: "/api/auth/mcp-token", headers });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ hasToken: true });
    });

    it("POST returns a fresh token once and stores only its hash", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 1 });
      (db.user.update as any).mockResolvedValue({});
      const first = JSON.parse((await app.inject({ method: "POST", url: "/api/auth/mcp-token", headers })).payload).mcpToken;
      const second = JSON.parse((await app.inject({ method: "POST", url: "/api/auth/mcp-token", headers })).payload).mcpToken;

      expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(second).not.toBe(first);
      const stored = (db.user.update as any).mock.calls.at(-1)[0].data;
      expect(stored).toEqual({ mcpTokenHash: hashMcpToken(second) });
    });
  });

  describe("API key", () => {
    const me = (headers: Record<string, string>) => app.inject({ method: "GET", url: "/api/auth/me", headers });

    beforeEach(() => {
      (db.user.findFirst as any).mockReset();
      (db.user.findUnique as any).mockResolvedValue({ id: 2, name: "U2", email: "u2@example.com", avatarUrl: null });
    });

    it("refuses a wrong key outright", async () => {
      expect((await me({ "x-api-key": "wrong" })).statusCode).toBe(401);
      expect((await me({ "x-api-key": "test-api-key-but-longer" })).statusCode).toBe(401);
      expect(db.user.findFirst).not.toHaveBeenCalled();
    });

    it("acts as the user named by x-user-id", async () => {
      (db.user.findFirst as any).mockResolvedValue({ id: 2 });
      expect((await me({ "x-api-key": "test-api-key", "x-user-id": "2" })).statusCode).toBe(200);
      expect((db.user.findFirst as any).mock.calls[0][0].where).toEqual({ id: 2 });
    });

    it("refuses an unknown or malformed x-user-id", async () => {
      (db.user.findFirst as any).mockResolvedValue(null);
      expect((await me({ "x-api-key": "test-api-key", "x-user-id": "999" })).statusCode).toBe(401);
      expect((await me({ "x-api-key": "test-api-key", "x-user-id": "abc" })).statusCode).toBe(401);
    });

    it("without x-user-id, refuses when no default user is configured", async () => {
      const previous = config.apiDefaultUserId;
      config.apiDefaultUserId = null;
      try {
        expect((await me({ "x-api-key": "test-api-key" })).statusCode).toBe(401);
        expect(db.user.findFirst).not.toHaveBeenCalled();
      } finally {
        config.apiDefaultUserId = previous;
      }
    });
  });
});
