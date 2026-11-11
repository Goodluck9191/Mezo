import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Staging runs against a hosted region; network latency makes the
    // 5 s default too tight for tests that issue many sequential queries.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
