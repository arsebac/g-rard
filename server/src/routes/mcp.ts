import { FastifyInstance } from "fastify";
import { config } from "../config";

/**
 * MCP route integration using @modelcontextprotocol/sdk.
 * 
 * Since @modelcontextprotocol/sdk is ESM and this project is CommonJS,
 * we use dynamic imports.
 */
export default async function mcpRoutes(app: FastifyInstance) {
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
  const { server: mcpServer } = await import("@gerard/mcp");

  // Create transport
  const transport = new StreamableHTTPServerTransport({
    // Optional: protection against DNS rebinding
    // allowedHosts: [config.host],
  });

  // Connect the MCP server to the transport
  await mcpServer.connect(transport);

  // GET /mcp (priming for SSE) and POST /mcp (messages)
  app.all("/mcp", async (request, reply) => {
    // 1. Check for API key if configured
    if (config.apiKey) {
      const apiKeyHeader = request.headers["x-api-key"];
      if (apiKeyHeader !== config.apiKey) {
        return reply.status(401).send({ error: "Invalid GERARD_API_KEY" });
      }
    }

    // 2. Delegate to MCP transport
    // StreamableHTTPServerTransport.handleRequest expects Node.js IncomingMessage and ServerResponse.
    // Fastify's request.raw and reply.raw are the underlying Node.js objects.
    await transport.handleRequest(request.raw, reply.raw);

    // Fastify needs to know we've handled the response (hijack)
    reply.hijack();
  });
}
