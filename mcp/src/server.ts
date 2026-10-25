import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import type { ApiClient } from "./client.js";
import { registerDocumentResources } from "./resources.js";
import { tools } from "./tools/index.js";
import { err } from "./tools/types.js";

const toolsByName = new Map(tools.map((t) => [t.name, t]));

export function createGerardServer(api: ApiClient) {
  const server = new Server({ name: "gerard", version: "1.0.0" }, { capabilities: { tools: {}, resources: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolsByName.get(name);
    if (!tool) return err(`Unknown tool: ${name}`);
    try {
      return await tool.handler(args, api);
    } catch (e) {
      if (e instanceof ZodError) {
        return err(`Invalid arguments: ${e.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`);
      }
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  registerDocumentResources(server, api);
  return server;
}
