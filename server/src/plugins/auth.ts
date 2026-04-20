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
 * Checks if a user has access to a specific project.
 * Returns the user's role if they have access, or null.
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
  
  // If the project is public, any logged-in user has at least the member role
  if (project.isPublic) {
    return "member" as ProjectMemberRole;
  }

  return null;
}

/**
 * Middleware to require membership (or admin status) in a project.
 * The projectId must be present in req.params.projectId or req.params.id.
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
    return reply.status(404).send({ error: "Project not found" });
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

  return reply.status(403).send({ error: "Access denied to project" });
};

/**
 * Middleware to require ADMIN status in a project.
 */
export const requireProjectAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
  await requireProjectMember(req, reply);
  if (reply.sent) return;

  if (req.projectRole !== "admin") {
    return reply.status(403).send({ error: "Administrator rights required for this project" });
  }
};

export const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
  // Support API key authentication (for the MCP server)
  const apiKey = req.headers["x-api-key"];
  if (apiKey && config.apiKey && apiKey === config.apiKey) {
    const userIdHeader = req.headers["x-user-id"];
    if (userIdHeader) {
      const userId = parseInt(String(userIdHeader));
      if (!isNaN(userId)) {
        req.currentUserId = userId;
        return;
      }
    }

    // Fallback to the first admin user as the actor for MCP requests
    const firstUser = await db.user.findFirst({ orderBy: { id: "asc" } });
    if (firstUser) {
      req.currentUserId = firstUser.id;
      return;
    }
  }

  if (!req.session.userId) {
    reply.status(401).send({ error: "Not authenticated" });
  } else {
    req.currentUserId = req.session.userId;
  }
};

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("currentUserId", 0);
  app.decorateRequest("projectRole", null);
});
