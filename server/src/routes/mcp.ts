import { FastifyInstance } from "fastify";
import { db } from "../db";

/**
 * MCP route integration using local logic to avoid ESM/CJS hang.
 */
export default async function mcpRoutes(app: FastifyInstance) {
  console.log("[MCP Route] Loading local modules...");
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
  const { mcpServer, mcpContextStorage } = await import("../mcp-logic");
  console.log("[MCP Route] Local logic loaded.");

  const sessionUserMap = new Map<string, number>();
  const transport = new StreamableHTTPServerTransport({});

  await mcpServer.connect(transport);
  console.log("[MCP Route] Server connected to transport.");

  app.all("/mcp", async (request, reply) => {
    let userId: number | undefined;

    if (request.method === "GET") {
      const token = (request.query as any).token || request.headers["x-mcp-token"];
      if (!token) return reply.status(401).send({ error: "Missing MCP token" });

      const user = await db.user.findUnique({ where: { mcpToken: token } });
      if (!user) return reply.status(401).send({ error: "Invalid MCP token" });
      userId = user.id;
    } else if (request.method === "POST") {
      const sessionId = (request.query as any).sessionId;
      if (sessionId) userId = sessionUserMap.get(sessionId);
    }

    if (!userId && request.method === "POST") {
      return reply.status(401).send({ error: "Unauthorized session" });
    }

    if (userId) {
      await mcpContextStorage.run({ userId }, async () => {
        if (request.method === "GET") {
          await transport.handleRequest(request.raw, reply.raw);
          const anyTransport = transport as any;
          if (anyTransport._sessions) {
            for (const sid of anyTransport._sessions.keys()) {
              if (!sessionUserMap.has(sid)) {
                sessionUserMap.set(sid, userId!);
                break;
              }
            }
          }
        } else {
          await transport.handleRequest(request.raw, reply.raw);
        }
      });
    } else {
       await transport.handleRequest(request.raw, reply.raw);
    }
    reply.hijack();
  });
}
