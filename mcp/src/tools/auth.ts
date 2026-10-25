import type { Tool } from "./types.js";
import { ok } from "./types.js";

export const authTools: Tool[] = [
  {
    name: "get_auth_url",
    description: "Get the authentication URL to link your Gérard account to the MCP server",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async (_args, api) =>
      ok({
        authUrl: `${api.baseUrl}/mcp-auth`,
        instructions:
          "Get your token on this page and use it in your MCP client configuration (e.g., as a query param ?token=... or header x-mcp-token).",
      }),
  },
];
