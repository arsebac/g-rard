"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpContextStorage = void 0;
exports.getMcpUserId = getMcpUserId;
const node_async_hooks_1 = require("node:async_hooks");
exports.mcpContextStorage = new node_async_hooks_1.AsyncLocalStorage();
function getMcpUserId() {
    const context = exports.mcpContextStorage.getStore();
    if (!context) {
        // If no context, we might be running in stdio mode or without auth.
        // For now, return a default or throw.
        // Given the requirement "same rights as their account", we should probably throw
        // if we expect auth.
        throw new Error("No user context found for MCP request");
    }
    return context.userId;
}
