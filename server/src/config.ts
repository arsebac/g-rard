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
  cfAccess: {
    teamDomain: cfAccessTeamDomain,
    aud: process.env.CF_ACCESS_AUD || null,
  },
};
