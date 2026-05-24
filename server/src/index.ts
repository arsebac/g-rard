import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { config } from "./config";
import { createServer } from "./app";

async function start() {
  console.log("Starting Gérard server...");
  console.log(`Current working directory: ${process.cwd()}`);

  try {
    console.log("Running database migrations...");
    execSync("npx prisma migrate deploy --schema=./prisma/schema.prisma", {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });
    console.log("Migrations applied.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
  const app = await createServer();

  // Create uploads folder if necessary
  if (!fs.existsSync(config.uploadDir)) {
    console.log(`Creating upload directory: ${config.uploadDir}`);
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }

  // In production: serve Vite build
  if (!config.isDev) {
    console.log("Running in production mode...");
    const staticPlugin = await import("@fastify/static");
    const clientDist = path.join(__dirname, "../../client/dist");
    await app.register(staticPlugin.default, { root: clientDist, prefix: "/" });
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile("index.html");
    });
  }

  console.log(`Attempting to listen on port ${config.port}...`);
  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`✅ Gérard server is now listening on http://localhost:${config.port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
