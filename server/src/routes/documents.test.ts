import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { Readable } from "stream";
import { createServer } from "../app";
import { FastifyInstance } from "fastify";

vi.mock("../db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    document: { findUnique: vi.fn() },
    documentSpace: { findUnique: vi.fn() },
  },
}));

vi.mock("../services/storage", () => ({
  storageService: { getStream: vi.fn(() => Readable.from([Buffer.from("content")])) },
}));

import { db } from "../db";

function storedDocument(filename: string, mimeType: string) {
  (db.document.findUnique as any).mockResolvedValue({ id: 1, spaceId: 2, filename, mimeType, storedPath: "2026/10/x" });
}

describe("GET /api/documents/:id/download", () => {
  let app: FastifyInstance;
  const headers = { "x-api-key": "test-api-key" };

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    (db.user.findFirst as any).mockResolvedValue({ id: 1 });
    (db.documentSpace.findUnique as any).mockResolvedValue({ id: 2, members: [{ userId: 1, role: "viewer" }], parent: null });
  });

  it("never renders HTML inline, whatever the uploader claimed", async () => {
    storedDocument("page.html", "text/html");
    const response = await app.inject({ method: "GET", url: "/api/documents/1/download?inline=1", headers });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/octet-stream");
    expect(response.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(response.headers["content-security-policy"]).toBe("sandbox");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("previews a PDF inline", async () => {
    storedDocument("plan.pdf", "application/pdf");
    const response = await app.inject({ method: "GET", url: "/api/documents/1/download?inline=1", headers });
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toMatch(/^inline;/);
  });

  it("downloads a PDF without inline=1", async () => {
    storedDocument("plan.pdf", "application/pdf");
    const response = await app.inject({ method: "GET", url: "/api/documents/1/download", headers });
    expect(response.headers["content-disposition"]).toMatch(/^attachment;/);
  });

  it("encodes a hostile filename", async () => {
    storedDocument('a"b\r\nSet-Cookie: x=1\'.pdf', "application/pdf");
    const response = await app.inject({ method: "GET", url: "/api/documents/1/download", headers });
    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.headers["content-disposition"]).toBe(
      "attachment; filename*=UTF-8''a%22b%0D%0ASet-Cookie%3A%20x%3D1%27.pdf"
    );
  });

  it("refuses a user outside the space", async () => {
    storedDocument("plan.pdf", "application/pdf");
    (db.documentSpace.findUnique as any).mockResolvedValue({ id: 2, members: [], parent: null });
    const response = await app.inject({ method: "GET", url: "/api/documents/1/download", headers });
    expect(response.statusCode).toBe(403);
  });
});
