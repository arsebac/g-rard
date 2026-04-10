import Fastify from "fastify";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import cors from "@fastify/cors";
import path from "path";
import fs from "fs";
import { config } from "./config";
import authPlugin from "./plugins/auth";
import multipartPlugin from "./plugins/multipart";
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import userRoutes from "./routes/users";
import commentRoutes from "./routes/comments";
import labelRoutes from "./routes/labels";
import wikiRoutes from "./routes/wiki";
import attachmentRoutes from "./routes/attachments";
import searchRoutes from "./routes/search";
import exportRoutes from "./routes/export";
import ticketTypeRoutes from "./routes/ticketTypes";
import taskLinkRoutes from "./routes/taskLinks";
import projectColumnRoutes from "./routes/projectColumns";
import workflowRoutes from "./routes/workflow";

const app = Fastify({ logger: config.isDev });

async function start() {
  // Créer le dossier uploads si nécessaire
  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }

  await app.register(cors, {
    origin: config.isDev ? "http://localhost:5173" : false,
    credentials: true,
  });

  await app.register(cookie);
  await app.register(session, {
    secret: config.sessionSecret,
    cookie: {
      secure: !config.isDev,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    },
  });

  const staticPlugin = await import("@fastify/static");
  await app.register(staticPlugin.default, {
    root: path.resolve(config.uploadDir),
    prefix: "/uploads/",
    decorateReply: false,
  });

  await app.register(authPlugin);
  await app.register(multipartPlugin);

  // Routes API
  await app.register(authRoutes);
  await app.register(projectRoutes);
  await app.register(taskRoutes);
  await app.register(userRoutes);
  await app.register(commentRoutes);
  await app.register(labelRoutes);
  await app.register(wikiRoutes);
  await app.register(attachmentRoutes);
  await app.register(searchRoutes);
  await app.register(exportRoutes);
  await app.register(ticketTypeRoutes);
  await app.register(taskLinkRoutes);
  await app.register(projectColumnRoutes);
  await app.register(workflowRoutes);

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
