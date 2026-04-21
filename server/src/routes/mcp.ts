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
    const { method, url } = request;

    try {
      if (!token && method === "GET") {
        console.log(`[MCP] ${request.id} - Missing MCP token for GET`);
        return reply.status(401).send({ error: "Missing MCP token" });
      }

      let userId: number | undefined;
      if (token) {
        const user = await db.user.findUnique({ where: { mcpToken: token as string } });
        if (!user) {
          console.log(`[MCP] ${request.id} - Invalid MCP token: ${token}`);
          return reply.status(401).send({ error: "Invalid MCP token" });
        }
        userId = user.id;
      }

      console.log(`[MCP] ${request.id} - Handling ${method} ${url} for user ${userId || "unknown"}`);

      const transport = new StreamableHTTPServerTransport();
      const server = createMcpServer();
      await server.connect(transport);

      console.log(`[MCP] ${request.id} - Server connected to transport, hijacking reply`);
      reply.hijack();
      const res = reply.raw;
      const req = request.raw;

      const runHandler = async () => {
        try {
          console.log(`[MCP] ${request.id} - Calling transport.handleRequest...`);
          await transport.handleRequest(req, res, request.body);
          console.log(`[MCP] ${request.id} - transport.handleRequest finished`);
        } catch (transportErr) {
          console.error(`[MCP] ${request.id} - Transport error:`, transportErr);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Internal transport error", details: String(transportErr) }));
          }
        }
      };

      if (userId) {
        await mcpContextStorage.run({ userId }, runHandler);
      } else {
        await runHandler();
      }
    } catch (error) {
      console.error(`[MCP] ${request.id} - Global route error:`, error);
      if (!reply.sent) {
        reply.status(500).send({ error: "Internal server error in MCP route", details: String(error) });
      }
    }
  });}
