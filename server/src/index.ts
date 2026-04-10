import path from "path";
import fs from "fs";
import { config } from "./config";
import { createServer } from "./app";

async function start() {
  const app = await createServer();

  // Créer le dossier uploads si nécessaire
  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }

  // En production : servir le build Vite
  if (!config.isDev) {
    const staticPlugin = await import("@fastify/static");
    const clientDist = path.join(__dirname, "../../client/dist");
    await app.register(staticPlugin.default, { root: clientDist, prefix: "/" });
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile("index.html");
    });
  }

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`Gérard démarre sur http://localhost:${config.port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
