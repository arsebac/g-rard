import { FastifyInstance } from "fastify";
import { db } from "../db";

/**
 * MCP route integration using stateless transports.
 * Each request gets a fresh transport instance to avoid state collisions.
 * This is the most robust way to support multiple users via token auth.
 */
export default async function mcpRoutes(app: FastifyInstance) {
  console.log("[MCP Route] Loading modules...");
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
  const { createMcpServer, mcpContextStorage } = await import("../mcp-logic");

  app.all("/mcp", async (request, reply) => {
    const token = (request.query as any).token || request.headers["x-mcp-token"];
    
    try {
      if (!token) {
        console.log("[MCP] Missing MCP token");
        return reply.status(401).send({ error: "Missing MCP token" });
      }

      const user = await db.user.findUnique({ where: { mcpToken: token as string } });
      if (!user) {
        console.log("[MCP] Invalid MCP token");
        return reply.status(401).send({ error: "Invalid MCP token" });
      }
      const userId = user.id;

      console.log(`[MCP] Handling ${request.method} request for user ${userId}`);

      // In stateless mode, we create a fresh transport for every request.
      // This is required by the SDK to avoid message ID collisions and state reuse errors.
      const transport = new StreamableHTTPServerTransport();
      const server = createMcpServer();
      await server.connect(transport);

      // We MUST hijack the reply before passing it to the transport, 
      // because the transport will manage the raw Node.js response.
      reply.hijack();
      const res = reply.raw;
      const req = request.raw;

      await mcpContextStorage.run({ userId }, async () => {
        try {
          // Handle the request. 
          // For GET: This establishes the SSE stream and stays open.
          // For POST: This processes the message and sends the result in the HTTP response.
          await transport.handleRequest(req, res, request.body);
          console.log(`[MCP] ${request.method} request handled successfully`);
        } catch (transportErr) {
          console.error("[MCP] Transport error:", transportErr);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Internal transport error" }));
          }
        }
      });
    } catch (error) {
      console.error("[MCP] Global route error:", error);
      if (!reply.sent) {
        reply.status(500).send({ error: "Internal server error in MCP route" });
      }
    }
  });
}
