// Trailing slashes would break the issuer comparison, which is an exact match.
const cfAccessTeamDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.replace(/\/+$/, "") || null;

export const config = {
  port: parseInt(process.env.PORT ?? "3000"),
  sessionSecret: process.env.SESSION_SECRET ?? "dev-secret-change-in-production",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  isDev: process.env.NODE_ENV !== "production",
  apiKey: process.env.GERARD_API_KEY ?? null,
  // Cloudflare Access. Both values are deployment-specific and must come from
  // the environment: never hardcode them, this repository is public.
  // Unset means the feature is off and password sessions are the only path in.
  // CF_ACCESS_AUD accepts a comma-separated list: each Access application has
  // its own audience tag, so a deployment fronted by more than one -- a wildcard
  // for the web app plus a path-scoped one for /mcp, for instance -- must accept
  // every tag that can legitimately reach it.
  cfAccess: {
    teamDomain: cfAccessTeamDomain,
    aud: (process.env.CF_ACCESS_AUD || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  },
};
