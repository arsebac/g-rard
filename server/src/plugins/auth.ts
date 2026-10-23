import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { db } from "../db";
import { config } from "../config";
import { isAccessEnabled, verifyAccessToken } from "../services/cfAccess";
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

  return null;
}

/** What a caller intends to do on a project, from least to most privileged. */
export type ProjectAccessLevel = "read" | "write" | "admin";

const ROLE_RANK: Record<ProjectMemberRole, number> = { viewer: 0, member: 1, admin: 2 };
const LEVEL_RANK: Record<ProjectAccessLevel, number> = { read: 0, write: 1, admin: 2 };

/**
 * Checks that the current user may act on a project at the given level, and
 * answers 403 when not. Returns true when the handler may proceed; otherwise
 * the reply is already sent and the handler must return it.
 */
export async function ensureProjectAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  projectId: number,
  level: ProjectAccessLevel
): Promise<boolean> {
  const role = await getProjectAccess(req.currentUserId, projectId);
  if (!role) {
    reply.status(403).send({ error: "Access denied to project" });
    return false;
  }
  if (ROLE_RANK[role] < LEVEL_RANK[level]) {
    reply.status(403).send({
      error: level === "admin" ? "Administrator rights required for this project" : "Viewers cannot perform write operations",
    });
    return false;
  }
  return true;
}

/**
 * Loads a task and checks access to its project. Returns the task's ids when
 * the handler may proceed; otherwise null, with a 400/403/404 already sent.
 */
export async function ensureTaskAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  taskId: number,
  level: ProjectAccessLevel
): Promise<{ id: number; projectId: number } | null> {
  if (isNaN(taskId)) {
    reply.status(400).send({ error: "Invalid task id" });
    return null;
  }
  const task = await db.task.findUnique({ where: { id: taskId }, select: { id: true, projectId: true } });
  if (!task) {
    reply.status(404).send({ error: "Task not found" });
    return null;
  }
  return (await ensureProjectAccess(req, reply, task.projectId, level)) ? task : null;
}

/**
 * Middleware: passes for any project member (admin, member, viewer).
 * Use on read-only routes.
 */
export const requireProjectViewer = async (req: FastifyRequest, reply: FastifyReply) => {
  const projectIdStr = (req.params as any).projectId || (req.params as any).id;
  const projectId = parseInt(projectIdStr);
  if (isNaN(projectId)) {
    return reply.status(400).send({ error: "Invalid project id" });
  }

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

  return reply.status(403).send({ error: "Access denied to project" });
};

/**
 * Middleware: passes for admin and member only. Blocks viewers.
 * Use on write routes.
 */
export const requireProjectMember = async (req: FastifyRequest, reply: FastifyReply) => {
  await requireProjectViewer(req, reply);
  if (reply.sent) return;

  if ((req.projectRole as string) === "viewer") {
    return reply.status(403).send({ error: "Viewers cannot perform write operations" });
  }
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

  // Cloudflare Access. When the app is reached through the tunnel, the signed
  // JWT is the authoritative identity, so it is checked before the session.
  // Users are matched on email and are never created implicitly: an identity
  // with no matching account is refused rather than provisioned.
  if (isAccessEnabled()) {
    const token = req.headers["cf-access-jwt-assertion"];
    if (typeof token === "string" && token.length > 0) {
      const identity = await verifyAccessToken(token);
      if (!identity) {
        return reply.status(401).send({ error: "Invalid Cloudflare Access token" });
      }

      const user = await db.user.findUnique({ where: { email: identity.email } });
      if (!user) {
        return reply.status(403).send({ error: "No account matches this identity" });
      }

      req.currentUserId = user.id;
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
