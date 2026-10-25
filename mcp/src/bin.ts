#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApiClient } from "./client.js";
import { createGerardServer } from "./server.js";

async function main() {
  console.error("[MCP] Starting StdioServerTransport...");
  try {
    const api = createApiClient({
      baseUrl: process.env.GERARD_URL ?? "http://localhost:3000",
      apiKey: process.env.GERARD_API_KEY,
      getUserId: () => undefined,
    });
    const transport = new StdioServerTransport();
    await createGerardServer(api).connect(transport);
    console.error("[MCP] StdioServerTransport connected.");
  } catch (error) {
    console.error("[MCP] Failed to start StdioServerTransport:", error);
    process.exit(1);
  }
}

main();
