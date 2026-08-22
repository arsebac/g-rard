import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config";

/**
 * Identity carried by a verified Cloudflare Access token.
 */
export interface AccessIdentity {
  email: string;
  subject: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Lazily builds the remote key set. `jose` caches the fetched keys and
 * refreshes them on rotation, so this is created once per process.
 */
function getKeySet(teamDomain: string) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  }
  return jwks;
}

/**
 * True when both Cloudflare Access settings are present. When they are not,
 * the app falls back to password sessions only and behaves exactly as before.
 */
export function isAccessEnabled(): boolean {
  return Boolean(config.cfAccess.teamDomain && config.cfAccess.aud.length > 0);
}

/**
 * Verifies a Cloudflare Access JWT and returns the identity it asserts.
 *
 * The signature check is what makes this trustworthy. The plain
 * `Cf-Access-Authenticated-User-Email` header travels alongside the token but
 * can be forged by anyone able to reach this origin directly — for example
 * over the LAN, bypassing Cloudflare entirely — so it is never read here.
 *
 * Returns null when Access is not configured, or when the token fails
 * signature, issuer, audience or expiry validation.
 */
export async function verifyAccessToken(token: string): Promise<AccessIdentity | null> {
  const { teamDomain, aud } = config.cfAccess;
  if (!teamDomain || aud.length === 0) return null;

  try {
    // `jose` treats an array as "any of these", which is what we want: the token
    // only has to match the application it actually came through.
    const { payload } = await jwtVerify(token, getKeySet(teamDomain), {
      issuer: teamDomain,
      audience: aud,
    });

    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (!email) return null;

    return { email, subject: typeof payload.sub === "string" ? payload.sub : "" };
  } catch {
    return null;
  }
}
