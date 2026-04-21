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
import sprintRoutes from "./routes/sprints";
import recurringTaskRoutes from "./routes/recurringTasks";
import mcpRoutes from "./routes/mcp";

export async function createServer() {
  console.log("Initializing Fastify instance...");
  const app = Fastify({ 
    logger: config.isDev,
    bodyLimit: 10 * 1024 * 1024,
  });

  // 1. Security Headers - Relaxed for local HTTP development
  console.log("Registering security plugins...");
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: null, // Disable automatic HTTPS upgrade
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
    hsts: false, // Disable HSTS to prevent browser from forcing HTTPS
  });

  // 2. Rate Limiting (disabled in test to avoid 429 errors)
  if (process.env.NODE_ENV !== "test") {
    await app.register(rateLimit, {
      max: 1000,
      timeWindow: '1 minute',
    });
  }

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  });

  await app.register(cookie);
  await app.register(session, {
    secret: config.sessionSecret,
    cookie: {
      secure: false, // Must be false for plain HTTP
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

  // Global logging hooks
  app.addHook("onRequest", async (request, reply) => {
    console.log(`[REQ] ${request.id} - ${request.method} ${request.url}`);
  });

  app.addHook("onResponse", async (request, reply) => {
    console.log(`[RES] ${request.id} - ${request.method} ${request.url} - ${reply.statusCode} (${reply.elapsedTime.toFixed(2)}ms)`);
  });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    console.error(`[ERR] ${request.id} - Error handling request ${request.method} ${request.url}:`, error);
    let statusCode = error.statusCode || 500;
    let message = error.message;

    // Prisma unique constraint violation
    if (error.code === "P2002") {
      statusCode = 409;
      const target = (error as any).meta?.target as string[] | undefined;
      if (target?.includes("key")) {
        message = "A project with this key already exists";
      } else {
        message = "A record with this value already exists";
      }
    }

    const isClientError = statusCode >= 400 && statusCode < 500;
    request.log.error(error);

    reply.status(statusCode).send({
      error: isClientError ? message : "An internal server error occurred",
      code: error.code,
      details: (error as any).details || undefined,
    });
  });

  // Health check endpoint (public)
  app.get("/api/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // API Routes
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
  await app.register(sprintRoutes);
  await app.register(recurringTaskRoutes);
  console.log("Registering MCP routes...");
  await app.register(mcpRoutes);

  console.log("Server initialization complete.");
  return app;
}
