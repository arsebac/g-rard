import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyRequest } from "fastify";

vi.mock("../db", () => ({
  db: { user: { findUnique: vi.fn() } },
}));

vi.mock("./cfAccess", () => ({
  isAccessEnabled: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

import { db } from "../db";
import { isAccessEnabled, verifyAccessToken } from "./cfAccess";
import { authenticateMcpRequest } from "./mcpAuth";

const request = (headers: Record<string, string> = {}, query: Record<string, unknown> = {}) =>
  ({ headers, query }) as unknown as FastifyRequest;

describe("MCP request authentication", () => {
  beforeEach(() => {
    vi.mocked(db.user.findUnique).mockReset();
    vi.mocked(isAccessEnabled).mockReset().mockReturnValue(false);
    vi.mocked(verifyAccessToken).mockReset();
  });

  const tokenMatches = (token: string, userId: number) =>
    vi.mocked(db.user.findUnique).mockImplementation(async (args: any) =>
      args.where.mcpToken === token ? ({ id: userId } as any) : null
    );

  it("accepts the token as an Authorization Bearer header", async () => {
    tokenMatches("secret", 7);
    const result = await authenticateMcpRequest(request({ authorization: "Bearer secret" }));
    expect(result).toEqual({ userId: 7, method: "bearer" });
  });

  it("still accepts the legacy x-mcp-token header", async () => {
    tokenMatches("secret", 7);
    const result = await authenticateMcpRequest(request({ "x-mcp-token": "secret" }));
    expect(result).toEqual({ userId: 7, method: "header" });
  });

  it("still accepts the legacy query string token", async () => {
    tokenMatches("secret", 7);
    const result = await authenticateMcpRequest(request({}, { token: "secret" }));
    expect(result).toEqual({ userId: 7, method: "query" });
  });

  it("falls through to Access when the Authorization header is not one of our tokens", async () => {
    // An OAuth-capable client puts its own access token in this header, so an
    // unrecognised value must not end the chain.
    vi.mocked(isAccessEnabled).mockReturnValue(true);
    vi.mocked(verifyAccessToken).mockResolvedValue({ email: "user@example.com", subject: "s" });
    vi.mocked(db.user.findUnique).mockImplementation(async (args: any) =>
      args.where.email === "user@example.com" ? ({ id: 42 } as any) : null
    );

    const result = await authenticateMcpRequest(
      request({ authorization: "Bearer oauth:opaque", "cf-access-jwt-assertion": "valid.jwt" })
    );

    expect(result).toEqual({ userId: 42, method: "cloudflare-access" });
  });

  it("rejects an unknown token when nothing else can authenticate", async () => {
    tokenMatches("secret", 7);
    vi.mocked(isAccessEnabled).mockReturnValue(false);

    const result = await authenticateMcpRequest(request({ authorization: "Bearer wrong" }));
    expect(result).toBeNull();
  });

  it("falls back to Cloudflare Access when no token is supplied", async () => {
    vi.mocked(isAccessEnabled).mockReturnValue(true);
    vi.mocked(verifyAccessToken).mockResolvedValue({ email: "user@example.com", subject: "s" });
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: 42 } as any);

    const result = await authenticateMcpRequest(request({ "cf-access-jwt-assertion": "valid.jwt" }));
    expect(result).toEqual({ userId: 42, method: "cloudflare-access" });
  });

  it("prefers a supplied token over the ambient Access header", async () => {
    tokenMatches("secret", 7);
    vi.mocked(isAccessEnabled).mockReturnValue(true);

    const result = await authenticateMcpRequest(
      request({ authorization: "Bearer secret", "cf-access-jwt-assertion": "valid.jwt" })
    );

    expect(result).toEqual({ userId: 7, method: "bearer" });
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("ignores the Access header when Access is not configured", async () => {
    vi.mocked(isAccessEnabled).mockReturnValue(false);
    const result = await authenticateMcpRequest(request({ "cf-access-jwt-assertion": "valid.jwt" }));
    expect(result).toBeNull();
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects an Access identity with no matching account", async () => {
    vi.mocked(isAccessEnabled).mockReturnValue(true);
    vi.mocked(verifyAccessToken).mockResolvedValue({ email: "stranger@example.com", subject: "s" });
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const result = await authenticateMcpRequest(request({ "cf-access-jwt-assertion": "valid.jwt" }));
    expect(result).toBeNull();
  });

  it("rejects a request carrying no credentials at all", async () => {
    expect(await authenticateMcpRequest(request())).toBeNull();
  });
});
