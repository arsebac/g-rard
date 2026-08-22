import { FastifyInstance } from "fastify";
import { authenticateMcpRequest } from "../services/mcpAuth";

/**
 * MCP route integration using SSEServerTransport.
 * This transport handles the standard MCP SSE protocol:
 * 1. GET /mcp -> Establish SSE stream, sends 'endpoint' event with sessionId
 * 2. POST /mcp?sessionId=... -> Send JSON-RPC messages
 */

// We need to keep track of active transports to route POST messages to the right
// server instance. The owner is stored alongside so that a session can only be
// driven by the user it was opened for.
const activeTransports = new Map<string, { transport: any; userId: number }>();

export default async function mcpRoutes(app: FastifyInstance) {
  console.log("[MCP Route] Loading modules...");
  const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
  const { createMcpServer } = await import("../mcp-logic");

  app.all("/mcp", async (request, reply) => {
    const sessionId = (request.query as any).sessionId;
    const { method, url } = request;

    try {
      // 1. Authentication
      const identity = await authenticateMcpRequest(request);
      if (!identity) {
        console.log(`[MCP] ${request.id} - No valid credentials`);
        return reply.status(401).send({ error: "No valid credentials" });
      }
      const userId = identity.userId;

      if (identity.method === "query") {
        console.warn(
          `[MCP] ${request.id} - Token in the query string is deprecated and ends up in proxy logs. ` +
            `Send it as "Authorization: Bearer <token>" instead.`
        );
      }

      console.log(`[MCP] ${request.id} - Handling ${method} ${url} for user ${userId} via ${identity.method} (Session: ${sessionId || "new"})`);

      // 2. Handle GET (SSE Connection)
      if (method === "GET") {
        // The endpoint tells the client where to POST messages. Only clients that
        // authenticated through the query string need the token repeated there:
        // headers and the Cloudflare Access assertion already travel on every
        // request, and keeping the token out of the URL keeps it out of logs.
        const postEndpoint =
          identity.method === "query" ? `/mcp?token=${(request.query as any).token}` : "/mcp";
        const transport = new SSEServerTransport(postEndpoint, reply.raw);
        const server = createMcpServer(userId);
        
        await server.connect(transport);
        const transportSessionId = transport.sessionId;
        activeTransports.set(transportSessionId, { transport, userId });

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

        const session = activeTransports.get(sessionId as string);
        if (!session) {
          console.log(`[MCP] ${request.id} - Session not found: ${sessionId}`);
          return reply.status(404).send({ error: "Session not found or expired" });
        }

        if (session.userId !== userId) {
          console.warn(`[MCP] ${request.id} - Session ${sessionId} does not belong to user ${userId}`);
          return reply.status(403).send({ error: "Session belongs to another user" });
        }

        try {
          await session.transport.handlePostMessage(request.raw, reply.raw, request.body);
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
