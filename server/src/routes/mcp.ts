import { FastifyInstance } from "fastify";
import { db } from "../db";

/**
 * MCP route integration using SSEServerTransport.
 * This transport handles the standard MCP SSE protocol:
 * 1. GET /mcp -> Establish SSE stream, sends 'endpoint' event with sessionId
 * 2. POST /mcp?sessionId=... -> Send JSON-RPC messages
 */

// We need to keep track of active transports to route POST messages to the right server instance
const activeTransports = new Map<string, any>();

export default async function mcpRoutes(app: FastifyInstance) {
  console.log("[MCP Route] Loading modules...");
  const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
  const { createMcpServer } = await import("../mcp-logic");

  app.all("/mcp", async (request, reply) => {
    const token = (request.query as any).token || request.headers["x-mcp-token"];
    const sessionId = (request.query as any).sessionId;
    const { method, url } = request;

    try {
      // 1. Authentication
      if (!token) {
        console.log(`[MCP] ${request.id} - Missing MCP token`);
        return reply.status(401).send({ error: "Missing MCP token" });
      }

      const user = await db.user.findUnique({ where: { mcpToken: token as string } });
      if (!user) {
        console.log(`[MCP] ${request.id} - Invalid MCP token: ${token}`);
        return reply.status(401).send({ error: "Invalid MCP token" });
      }
      const userId = user.id;

      console.log(`[MCP] ${request.id} - Handling ${method} ${url} for user ${userId} (Session: ${sessionId || "new"})`);

      // 2. Handle GET (SSE Connection)
      if (method === "GET") {
        // Create a new transport and server for this connection
        // The endpoint tells the client where to POST messages. 
        // We include the token so subsequent POSTs are also authenticated.
        const transport = new SSEServerTransport(`/mcp?token=${token}`, reply.raw);
        const server = createMcpServer(userId);
        
        await server.connect(transport);
        const transportSessionId = transport.sessionId;
        activeTransports.set(transportSessionId, transport);

        console.log(`[MCP] ${request.id} - SSE connection established. Session: ${transportSessionId}`);

        transport.onclose = () => {
          console.log(`[MCP] Session ${transportSessionId} closed`);
          activeTransports.delete(transportSessionId);
        };

        // SSEServerTransport.start() is called by server.connect()
        // It writes the headers and the 'endpoint' event.
        reply.hijack();
        return;
      }

      // 3. Handle POST (Messages)
      if (method === "POST") {
        if (!sessionId) {
          return reply.status(400).send({ error: "Missing sessionId" });
        }

        const transport = activeTransports.get(sessionId as string);
        if (!transport) {
          console.log(`[MCP] ${request.id} - Session not found: ${sessionId}`);
          return reply.status(404).send({ error: "Session not found or expired" });
        }

        try {
          await transport.handlePostMessage(request.raw, reply.raw, request.body);
        } catch (err) {
          console.error(`[MCP] ${request.id} - Error handling POST message:`, err);
          if (!reply.raw.headersSent) {
            reply.status(500).send({ error: "Error handling message" });
          }
        }
        return;
      }

      // 4. Other methods
      return reply.status(405).send({ error: "Method not allowed" });

    } catch (error) {
      console.error(`[MCP] ${request.id} - Global route error:`, error);
      if (!reply.sent) {
        reply.status(500).send({ error: "Internal server error in MCP route", details: String(error) });
      }
    }
  });
}
