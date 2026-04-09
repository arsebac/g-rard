import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcrypt";
import { db } from "../db";
import { requireAuth } from "../plugins/auth";
import { storageService } from "../services/storage";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

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

  // POST /api/users/me/avatar — upload d'avatar
  app.post("/api/users/me/avatar", { preHandler: requireAuth }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "Fichier requis" });

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
