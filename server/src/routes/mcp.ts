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
    console.log(`[MCP] Incoming request: ${request.method} ${request.url}`);
    try {
      let userId: number | undefined;

      if (request.method === "GET") {
        const token = (request.query as any).token || request.headers["x-mcp-token"];
        console.log(`[MCP] GET request with token: ${token ? "present" : "missing"}`);
        if (!token) {
          console.log("[MCP] Missing MCP token");
          return reply.status(401).send({ error: "Missing MCP token" });
        }

        const user = await db.user.findUnique({ where: { mcpToken: token } });
        if (!user) {
          console.log("[MCP] Invalid MCP token");
          return reply.status(401).send({ error: "Invalid MCP token" });
        }
        userId = user.id;
        console.log(`[MCP] Authenticated user ID: ${userId}`);
      } else if (request.method === "POST") {
        const sessionId = (request.query as any).sessionId;
        console.log(`[MCP] POST request with sessionId: ${sessionId}`);
        if (sessionId) userId = sessionUserMap.get(sessionId);
        console.log(`[MCP] Resolved user ID from session: ${userId}`);
      }

      if (!userId && request.method === "POST") {
        console.log("[MCP] Unauthorized POST session");
        return reply.status(401).send({ error: "Unauthorized session" });
      }

      const handleMcpRequest = async () => {
        console.log("[MCP] Handling request with transport...");
        try {
          await transport.handleRequest(request.raw, reply.raw);
          console.log("[MCP] transport.handleRequest completed");
          
          if (request.method === "GET") {
            const anyTransport = transport as any;
            if (anyTransport._sessions) {
              for (const sid of anyTransport._sessions.keys()) {
                if (!sessionUserMap.has(sid)) {
                  console.log(`[MCP] Mapping session ${sid} to user ${userId}`);
                  sessionUserMap.set(sid, userId!);
                  break;
                }
              }
            }
          }
        } catch (transportErr) {
          console.error("[MCP] Transport error:", transportErr);
          throw transportErr;
        }
      };

      if (userId) {
        await mcpContextStorage.run({ userId }, handleMcpRequest);
      } else {
        await handleMcpRequest();
      }
      
      console.log("[MCP] Hijacking reply...");
      reply.hijack();
    } catch (error) {
      console.error("[MCP] Global route error:", error);
      if (!reply.sent) {
        reply.status(500).send({ error: "Internal server error in MCP route" });
      }
    }
  });
}
