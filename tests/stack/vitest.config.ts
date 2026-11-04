import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/stack/**/*.test.ts"], root: new URL("../..", import.meta.url).pathname, testTimeout: 15000 },
});
