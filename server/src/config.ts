export const config = {
  port: parseInt(process.env.PORT ?? "3000"),
  sessionSecret: process.env.SESSION_SECRET ?? "dev-secret-change-in-production",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  isDev: process.env.NODE_ENV !== "production",
  apiKey: process.env.GERARD_API_KEY ?? null,
};
