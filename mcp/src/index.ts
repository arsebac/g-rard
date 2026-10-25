/**
 * Gerard MCP Server — control your home project manager from Claude Code.
 * Shared by the stdio binary (bin.ts) and the server's HTTP /mcp route.
 */

export { createApiClient } from "./client.js";
export type { ApiClient, ApiClientOptions } from "./client.js";
export { createGerardServer } from "./server.js";
