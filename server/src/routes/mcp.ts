import { FastifyInstance } from "fastify";
import { authenticateMcpRequest } from "../services/mcpAuth";

/**
 * MCP endpoint, Streamable HTTP transport.
 *
 * Served stateless: this server only answers tool calls and never pushes
 * anything of its own, so there is no session state worth carrying between
 * requests. Each request gets its own server and transport, which also removes
 * any possibility of one caller reaching another's session.
 */
export default async function mcpRoutes(app: FastifyInstance) {
  console.log("[MCP Route] Loading modules...");
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const { createMcpServer } = await import("../mcp-logic");

  app.all("/mcp", async (request, reply) => {
    const identity = await authenticateMcpRequest(request);
    if (!identity) {
      console.log(`[MCP] ${request.id} - No valid credentials`);
      return reply.status(401).send({ error: "No valid credentials" });
    }

    if (identity.method === "query") {
      console.warn(
        `[MCP] ${request.id} - Token in the query string is deprecated and ends up in proxy logs. ` +
          `Send it as "Authorization: Bearer <token>" instead.`
      );
    }

    console.log(
      `[MCP] ${request.id} - ${request.method} ${request.url} for user ${identity.userId} via ${identity.method}`
    );

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer(identity.userId);

    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      // The transport writes the response itself, so Fastify must step aside.
      reply.hijack();
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
      console.error(`[MCP] ${request.id} - Route error:`, error);
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "Content-Type": "application/json" });
        reply.raw.end(JSON.stringify({ error: "Internal server error in MCP route" }));
      }
    }
  });
}
