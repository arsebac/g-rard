import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { db } from "../db";
import { config } from "../config";

declare module "@fastify/session" {
  interface FastifySessionObject {
    userId?: number;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    currentUserId: number;
  }
}

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
});
