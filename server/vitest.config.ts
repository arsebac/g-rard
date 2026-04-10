import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Charger les variables .env si nécessaire
    env: {
      DATABASE_URL: "mysql://gerard:password@localhost:3306/gerard_test",
      SESSION_SECRET: "test-secret-32-chars-long-at-least-!",
      GERARD_API_KEY: "test-api-key"
    }
  },
});
