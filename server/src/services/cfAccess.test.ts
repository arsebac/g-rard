import { describe, it, expect, beforeAll, vi } from "vitest";
import { SignJWT, generateKeyPair } from "jose";
import type { KeyLike } from "jose";

// vi.mock factories are hoisted above module scope, so anything they close
// over has to be hoisted with them.
const h = vi.hoisted(() => ({
  teamDomain: "https://test-team.cloudflareaccess.com",
  aud: "test_application_audience_tag",
  publicKey: undefined as unknown,
}));

const TEAM_DOMAIN = h.teamDomain;
const AUD = h.aud;

vi.mock("../config", () => ({
  config: { cfAccess: { teamDomain: h.teamDomain, aud: h.aud } },
}));

// Resolve keys locally instead of fetching the remote JWKS, so the real
// signature verification in `jose` still runs against a known key pair.
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return { ...actual, createRemoteJWKSet: () => async () => h.publicKey };
});

import { verifyAccessToken, isAccessEnabled } from "./cfAccess";

describe("Cloudflare Access token verification", () => {
  let privateKey: KeyLike;
  let otherPrivateKey: KeyLike;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    h.publicKey = pair.publicKey;
    otherPrivateKey = (await generateKeyPair("RS256")).privateKey;
  });

  const sign = (
    key: KeyLike,
    claims: Record<string, unknown> = {},
    { issuer = TEAM_DOMAIN, audience = AUD, expiresIn = "1h" } = {}
  ) =>
    new SignJWT({ email: "user@example.com", ...claims })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime(expiresIn)
      .setSubject("subject-id")
      .sign(key);

  it("is enabled when both settings are present", () => {
    expect(isAccessEnabled()).toBe(true);
  });

  it("accepts a correctly signed token and returns the identity", async () => {
    const identity = await verifyAccessToken(await sign(privateKey));
    expect(identity).toEqual({ email: "user@example.com", subject: "subject-id" });
  });

  it("lowercases the email so it matches stored accounts", async () => {
    const identity = await verifyAccessToken(await sign(privateKey, { email: "User@Example.COM" }));
    expect(identity?.email).toBe("user@example.com");
  });

  it("rejects a token signed by a different key", async () => {
    expect(await verifyAccessToken(await sign(otherPrivateKey))).toBeNull();
  });

  it("rejects a token issued for another application", async () => {
    expect(await verifyAccessToken(await sign(privateKey, {}, { audience: "other_aud" }))).toBeNull();
  });

  it("rejects a token from another team domain", async () => {
    const token = await sign(privateKey, {}, { issuer: "https://evil.cloudflareaccess.com" });
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it("rejects an expired token", async () => {
    expect(await verifyAccessToken(await sign(privateKey, {}, { expiresIn: "-1h" }))).toBeNull();
  });

  it("rejects a token carrying no email claim", async () => {
    expect(await verifyAccessToken(await sign(privateKey, { email: undefined }))).toBeNull();
  });

  it("rejects a malformed token", async () => {
    expect(await verifyAccessToken("not-a-jwt")).toBeNull();
  });
});
