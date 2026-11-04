import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: process.env.RPANEL_URL || "http://127.0.0.1" },
});
