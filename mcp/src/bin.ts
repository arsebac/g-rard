#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./index.js";

async function main() {
  console.error("[MCP] Starting StdioServerTransport...");
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[MCP] StdioServerTransport connected.");
  } catch (error) {
    console.error("[MCP] Failed to start StdioServerTransport:", error);
    process.exit(1);
  }
}

main();
