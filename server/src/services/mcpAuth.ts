import { FastifyRequest } from "fastify";
import crypto from "crypto";
import { db } from "../db";
import { isAccessEnabled, verifyAccessToken } from "./cfAccess";

/** Only the SHA-256 of a token is stored, so a database leak does not hand out working tokens. */
export function hashMcpToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** A fresh token: 256 random bits, URL-safe. */
export function generateMcpToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** How a request proved who it is. Kept for logging and for deprecation notices. */
export type McpAuthMethod = "bearer" | "header" | "cloudflare-access";

export interface McpIdentity {
  userId: number;
  method: McpAuthMethod;
}

interface SuppliedToken {
  token: string;
  method: Extract<McpAuthMethod, "bearer" | "header">;
}

/**
 * Reads the MCP token a client sent, in order of preference.
 *
 * `Authorization: Bearer` is the standard form and the one to prefer: every MCP
 * client supports it. `x-mcp-token` predates it and is kept for existing
 * configurations. A token in the query string is refused: URLs end up in
 * proxy and access logs.
 */
function readSuppliedToken(req: FastifyRequest): SuppliedToken | null {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) return { token, method: "bearer" };
  }

  const headerToken = req.headers["x-mcp-token"];
  if (typeof headerToken === "string" && headerToken) {
    return { token: headerToken, method: "header" };
  }

  return null;
}

/**
 * Resolves the user behind an MCP request, trying each configured credential.
 *
 * A token the client supplied wins over the Cloudflare Access header, which the
 * infrastructure adds to every request that comes through the tunnel: a
 * deliberate credential should beat ambient context, and existing clients keep
 * behaving exactly as they did.
 *
 * A supplied token that matches nothing does not end the chain. An Authorization
 * header is not necessarily one of ours -- an OAuth-capable client puts its own
 * access token there -- so the remaining sources still get their turn. The
 * attempt is logged so that a stale configuration stays visible.
 *
 * The Cloudflare branch is inert unless Access is configured, so a deployment
 * without it is unaffected.
 */
export async function authenticateMcpRequest(req: FastifyRequest): Promise<McpIdentity | null> {
  const supplied = readSuppliedToken(req);
  if (supplied) {
    const user = await db.user.findUnique({ where: { mcpTokenHash: hashMcpToken(supplied.token) } });
    if (user) return { userId: user.id, method: supplied.method };
    console.warn(`[MCP] Unknown token supplied via ${supplied.method}; trying the remaining credentials`);
  }

  if (isAccessEnabled()) {
    const assertion = req.headers["cf-access-jwt-assertion"];
    if (typeof assertion === "string" && assertion) {
      const identity = await verifyAccessToken(assertion);
      if (identity) {
        const user = await db.user.findUnique({ where: { email: identity.email } });
        if (user) return { userId: user.id, method: "cloudflare-access" };
      }
    }
  }

  return null;
}
