import { FastifyInstance } from "fastify";
import { z } from "zod";
// @ts-ignore
import bcrypt from "bcrypt";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { config } from "../config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function authRoutes(app: FastifyInstance) {
  // Counted per targeted account rather than per IP: behind the tunnel every
  // request shares the proxy's address, and on the LAN forwarded headers can be forged.
  const loginRateLimit = {
    max: 10,
    timeWindow: "1 minute",
    hook: "preHandler" as const,
    keyGenerator: (req: { body?: unknown }) => {
      const email = (req.body as { email?: unknown } | undefined)?.email;
      return `login:${typeof email === "string" ? email.trim().toLowerCase() : ""}`;
    },
  };

  app.post("/api/auth/login", { config: { rateLimit: loginRateLimit } }, async (req, reply) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data" });
    }

    const user = await db.user.findUnique({ where: { email: body.data.email } });
    if (!user) {
      return reply.status(401).send({ error: "Incorrect email or password" });
    }

    const valid = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Incorrect email or password" });
    }


    req.session.userId = user.id;
    return reply.send({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    });
  });

  app.get("/api/auth/config", async () => ({ registration: config.allowRegistration }));

  app.post("/api/auth/register", async (req, reply) => {
    if (!config.allowRegistration) {
      return reply.status(403).send({ error: "Registration is disabled" });
    }
    const body = registerSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid data", details: body.error.flatten() });
    }

    const existing = await db.user.findUnique({ where: { email: body.data.email } });
    if (existing) {
      return reply.status(409).send({ error: "This email is already in use" });
    }


    const passwordHash = await bcrypt.hash(body.data.password, 10);
    const user = await db.user.create({
      data: { name: body.data.name, email: body.data.email, passwordHash },
    });

    req.session.userId = user.id;
    return reply.status(201).send({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    });
  });

  app.post("/api/auth/logout", async (req, reply) => {
    await req.session.destroy();
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (req, reply) => {
    const user = await db.user.findUnique({
      where: { id: req.currentUserId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    if (!user) {
      return reply.status(401).send({ error: "User not found" });
    }
    return reply.send(user);
  });

  app.get("/api/auth/mcp-token", { preHandler: requireAuth }, async (req, reply) => {
    let user = await db.user.findUnique({
      where: { id: req.currentUserId },
      select: { mcpToken: true },
    });

    if (!user) {
      return reply.status(401).send({ error: "User not found" });
    }

    if (!user.mcpToken) {
      const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await db.user.update({
        where: { id: req.currentUserId },
        data: { mcpToken: newToken },
      });
      return reply.send({ mcpToken: newToken });
    }

    return reply.send({ mcpToken: user.mcpToken });
  });
}
