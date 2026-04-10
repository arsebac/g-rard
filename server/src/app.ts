import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import cors from "@fastify/cors";
import path from "path";
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

export async function createServer() {
  const app = Fastify({ 
    logger: false, // Désactivé en test pour la clarté
    bodyLimit: 10 * 1024 * 1024,
  });

  // 1. Headers de sécurité
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "http://localhost:5173", "ws://localhost:5173"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // 2. Rate Limiting (désactivé en test pour éviter les 429)
  if (process.env.NODE_ENV !== "test") {
    await app.register(rateLimit, {
      max: 1000,
      timeWindow: '1 minute',
    });
  }

  await app.register(cors, {
    origin: config.isDev ? "http://localhost:5173" : false,
    credentials: true,
  });

  await app.register(cookie);
  await app.register(session, {
    secret: config.sessionSecret,
    cookie: {
      secure: !config.isDev && process.env.NODE_ENV !== "test",
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
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

  return app;
}
