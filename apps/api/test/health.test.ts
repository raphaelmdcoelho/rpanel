import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type RunningServer } from "../src/server.js";

describe("health", () => {
  let dir: string;
  let server: RunningServer;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "rpanel-test-"));
    server = await startServer({ port: 0, databasePath: join(dir, "test.sqlite") });
  });

  afterEach(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports ok when the API and its database are working", async () => {
    const res = await fetch(`${server.url}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: "ok" });
  });

  it("returns 404 for an unknown path", async () => {
    const res = await fetch(`${server.url}/api/nope`);
    expect(res.status).toBe(404);
  });
});
