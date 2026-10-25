import type { User } from "../types.js";
import type { Tool } from "./types.js";
import { ok } from "./types.js";

export const userTools: Tool[] = [
  {
    name: "list_users",
    description: "List Gérard users (for assignment)",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async (_args, api) => {
      const users = await api.get<User[]>("/api/users");
      return ok(users.map((u) => ({ id: u.id, name: u.name, email: u.email })));
    },
  },
];
