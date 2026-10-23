import { FastifyInstance } from "fastify";
import { z } from "zod";
// @ts-ignore
import bcrypt from "bcrypt";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { storageService } from "../services/storage";
import path from "path";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// Avatars are served by extension, so only raster image types are accepted.
const AVATAR_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export default async function userRoutes(app: FastifyInstance) {
  app.get("/api/users", { preHandler: requireAuth }, async (_req, reply) => {
    const users = await db.user.findMany({
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    return reply.send(users);
  });

  app.patch("/api/users/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    
    // Protection IDOR : seul l'utilisateur lui-même peut se modifier
    if (req.currentUserId !== parseInt(id)) {
      return reply.status(403).send({ error: "Accès refusé" });
    }

    const body = updateUserSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides" });
    }

    const user = await db.user.update({
      where: { id: parseInt(id) },
      data: body.data,
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    return reply.send(user);
  });

  app.patch("/api/users/:id/password", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (req.currentUserId !== parseInt(id)) {
      return reply.status(403).send({ error: "Accès refusé" });
    }

    const body = changePasswordSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Données invalides" });
    }

    const user = await db.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) return reply.status(404).send({ error: "Utilisateur introuvable" });

    const valid = await bcrypt.compare(body.data.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Mot de passe actuel incorrect" });
    }

    const newHash = await bcrypt.hash(body.data.newPassword, 10);
    await db.user.update({ where: { id: parseInt(id) }, data: { passwordHash: newHash } });
    return reply.send({ ok: true });
  });

  app.get("/api/users/:id/avatar", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await db.user.findUnique({ where: { id: parseInt(id) }, select: { avatarUrl: true } });
    const contentType = user?.avatarUrl ? AVATAR_TYPES[path.extname(user.avatarUrl).toLowerCase()] : undefined;
    if (!user?.avatarUrl || !contentType) return reply.status(404).send({ error: "No avatar" });

    reply.header("Content-Type", contentType);
    reply.header("Cache-Control", "private, max-age=3600");
    return reply.send(storageService.getStream(user.avatarUrl));
  });

  // POST /api/users/me/avatar — upload d'avatar
  app.post("/api/users/me/avatar", { preHandler: requireAuth }, async (req, reply) => {
    let data: Awaited<ReturnType<typeof req.file>> | undefined;
    try {
      data = await req.file();
    } catch {
      return reply.status(400).send({ error: "Fichier requis" });
    }
    if (!data) return reply.status(400).send({ error: "Fichier requis" });

    const expectedType = AVATAR_TYPES[path.extname(data.filename).toLowerCase()];
    if (!expectedType || data.mimetype !== expectedType) {
      data.file.resume();
      return reply.status(400).send({ error: "Avatar must be a PNG, JPEG, WebP or GIF image" });
    }

    // Supprimer l'ancien avatar si nécessaire
    const user = await db.user.findUnique({ where: { id: req.currentUserId } });
    if (user?.avatarUrl) {
      await storageService.deleteFile(user.avatarUrl);
    }

    const storedPath = await storageService.saveFile(data.file, data.filename);
    
    const updatedUser = await db.user.update({
      where: { id: req.currentUserId },
      data: { avatarUrl: storedPath },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    return reply.send(updatedUser);
  });
}
