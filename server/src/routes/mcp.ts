import { FastifyInstance } from "fastify";
import { db } from "../db";

/**
 * MCP route integration using @modelcontextprotocol/sdk.
 */
export default async function mcpRoutes(app: FastifyInstance) {
  // Use dynamic imports for ESM packages in this CommonJS server
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
  const { server: mcpServer } = await import("@gerard/mcp");
  const { mcpContextStorage } = await import("@gerard/mcp/context");

  // Map to store sessionId -> userId
  const sessionUserMap = new Map<string, number>();

  // Create transport
  const transport = new StreamableHTTPServerTransport({
    // Optional: protection against DNS rebinding
    // allowedHosts: [config.host],
  });

  // Connect the MCP server to the transport
  await mcpServer.connect(transport);

  // Wrap MCP request handling with user context
  app.all("/mcp", async (request, reply) => {
    // 1. Authenticate the request
    // For SSE (GET), we expect a token in the query params or x-mcp-token header
    // For POST, the sessionId is in the query params. We use sessionUserMap.
    
    let userId: number | undefined;

    if (request.method === "GET") {
      const token = (request.query as any).token || request.headers["x-mcp-token"];
      if (!token) {
        return reply.status(401).send({ error: "Missing MCP token" });
      }

      const user = await db.user.findUnique({ where: { mcpToken: token } });
      if (!user) {
        return reply.status(401).send({ error: "Invalid MCP token" });
      }
      userId = user.id;
    } else if (request.method === "POST") {
      const sessionId = (request.query as any).sessionId;
      if (sessionId) {
        userId = sessionUserMap.get(sessionId);
      }
    }

    if (!userId && request.method === "POST") {
      return reply.status(401).send({ error: "Unauthorized session" });
    }

    // 2. Delegate to MCP transport within context
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
