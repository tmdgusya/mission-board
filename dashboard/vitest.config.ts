import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Vitest 4.x can't bundle bun:test, alias to a no-op mock
      "bun:test": path.join(__dirname, "src/__mocks__/bun-test.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["dashboard/src/**/*.test.{ts,tsx}"],
    globals: true,
    setupFiles: ["./dashboard/src/test-setup.ts"],
  },
});
