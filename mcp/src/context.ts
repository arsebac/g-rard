import { AsyncLocalStorage } from "node:async_hooks";

export interface McpContext {
  userId: number;
}

export const mcpContextStorage = new AsyncLocalStorage<McpContext>();

export function getMcpUserId(): number {
  const context = mcpContextStorage.getStore();
  if (!context) {
    // If no context, we might be running in stdio mode or without auth.
    // For now, return a default or throw.
    // Given the requirement "same rights as their account", we should probably throw
    // if we expect auth.
    throw new Error("No user context found for MCP request");
  }
  return context.userId;
}
