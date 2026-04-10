import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { db } from "../db";
import { config } from "../config";
import { ProjectMemberRole } from "@prisma/client";

declare module "@fastify/session" {
  interface FastifySessionObject {
    userId?: number;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    currentUserId: number;
    projectRole?: ProjectMemberRole | null;
  }
}

/**
 * Vérifie si un utilisateur a accès à un projet spécifique.
 * Retourne le rôle de l'utilisateur si accès, ou null.
 */
export async function getProjectAccess(userId: number, projectId: number) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      members: { where: { userId } }
    }
  });

  if (!project) return null;

  const member = project.members[0];
  if (member) return member.role;
  
  // Si le projet est public, tout utilisateur connecté a au moins le rôle de membre
  if (project.isPublic) {
    return "member" as ProjectMemberRole;
  }

  return null;
}

/**
 * Middleware pour exiger d'être membre (ou admin) d'un projet.
 * Le projectId doit être présent dans req.params.projectId.
 */
export const requireProjectMember = async (req: FastifyRequest, reply: FastifyReply) => {
  const projectIdStr = (req.params as any).projectId || (req.params as any).id;
  if (!projectIdStr) return;

  const projectId = parseInt(projectIdStr);
  if (isNaN(projectId)) return;

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { members: { where: { userId: req.currentUserId } } },
  });

  if (!project) {
    return reply.status(404).send({ error: "Projet introuvable" });
  }

  const member = project.members[0];
  if (member) {
    req.projectRole = member.role;
    return;
  }

  if (project.isPublic) {
    req.projectRole = "member" as ProjectMemberRole;
    return;
  }

  return reply.status(403).send({ error: "Accès refusé au projet" });
};

/**
 * Middleware pour exiger d'être ADMIN d'un projet.
 */
export const requireProjectAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
  await requireProjectMember(req, reply);
  if (reply.sent) return;

  if (req.projectRole !== "admin") {
    return reply.status(403).send({ error: "Droits administrateur requis pour ce projet" });
  }
};

export const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
  // Support API key authentication (pour le serveur MCP)
  const apiKey = req.headers["x-api-key"];
  if (apiKey && config.apiKey && apiKey === config.apiKey) {
    // Utiliser le premier utilisateur admin comme acteur pour les requêtes MCP
    const firstUser = await db.user.findFirst({ orderBy: { id: "asc" } });
    if (firstUser) {
      req.currentUserId = firstUser.id;
      return;
    }
  }

  if (!req.session.userId) {
    reply.status(401).send({ error: "Non authentifié" });
  } else {
    req.currentUserId = req.session.userId;
  }
};

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("currentUserId", 0);
  app.decorateRequest("projectRole", null);
});
