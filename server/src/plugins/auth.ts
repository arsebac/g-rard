import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

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
  if (!req.session.userId) {
    reply.status(401).send({ error: "Non authentifié" });
  } else {
    req.currentUserId = req.session.userId;
  }
};

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("currentUserId", 0);
});
