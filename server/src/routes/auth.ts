import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcrypt";
import { db } from "../db";

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
  app.post("/api/auth/login", async (req, reply) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides" });
    }

    const user = await db.user.findUnique({ where: { email: body.data.email } });
    if (!user) {
      return reply.status(401).send({ error: "Email ou mot de passe incorrect" });
    }

    const valid = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Email ou mot de passe incorrect" });
    }

    req.session.userId = user.id;
    return reply.send({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    });
  });

  app.post("/api/auth/register", async (req, reply) => {
    const body = registerSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides", details: body.error.flatten() });
    }

    const existing = await db.user.findUnique({ where: { email: body.data.email } });
    if (existing) {
      return reply.status(409).send({ error: "Cet email est déjà utilisé" });
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

  app.get("/api/auth/me", async (req, reply) => {
    if (!req.session.userId) {
      return reply.status(401).send({ error: "Non authentifié" });
    }
    const user = await db.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    if (!user) {
      return reply.status(401).send({ error: "Utilisateur introuvable" });
    }
    return reply.send(user);
  });
}
