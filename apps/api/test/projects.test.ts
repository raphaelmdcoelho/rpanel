import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type RunningServer } from "../src/server.js";

const PASSWORD = "correct horse battery";

type Project = { id: number; name: string; createdAt: number };

// A signed-in browser: keeps the session cookie and CSRF token, like the web app does.
async function signIn(baseUrl: string, email: string) {
  const login = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(login.status).toBe(200);
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const { csrfToken } = (await login.json()) as { csrfToken: string };

  const call = (method: string, path: string, body?: unknown, withCsrf = true) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        cookie,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(withCsrf ? { "x-csrf-token": csrfToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return {
    call,
    async createProject(name: string): Promise<Project> {
      const res = await call("POST", "/api/projects", { name });
      expect(res.status).toBe(201);
      return (await res.json()) as Project;
    },
    async listProjects(): Promise<Project[]> {
      const res = await call("GET", "/api/projects");
      expect(res.status).toBe(200);
      return ((await res.json()) as { projects: Project[] }).projects;
    },
  };
}

describe("local Projects", () => {
  let dir: string;
  let server: RunningServer;
  let now: number;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "rpanel-test-"));
    now = Date.UTC(2026, 0, 1);
    server = await startServer({ port: 0, databasePath: join(dir, "test.sqlite"), now: () => now });
    await server.createUser({ email: "alice@example.com", password: PASSWORD });
    await server.createUser({ email: "bob@example.com", password: PASSWORD });
  });

  afterEach(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("lets a User create a Project and see it in their list", async () => {
    const alice = await signIn(server.url, "alice@example.com");
    expect(await alice.listProjects()).toEqual([]);

    const created = await alice.createProject("Billing rewrite");
    expect(created).toMatchObject({ name: "Billing rewrite" });

    expect(await alice.listProjects()).toEqual([created]);
  });

  it("trims the name and lists the newest Project first", async () => {
    const alice = await signIn(server.url, "alice@example.com");
    const first = await alice.createProject("  First  ");
    now += 1000;
    const second = await alice.createProject("Second");
    expect(first.name).toBe("First");
    expect((await alice.listProjects()).map((p) => p.name)).toEqual(["Second", "First"]);
    expect(second.createdAt).toBeGreaterThan(first.createdAt);
  });

  it("rejects an empty, blank or overlong name", async () => {
    const alice = await signIn(server.url, "alice@example.com");
    for (const name of ["", "   ", "x".repeat(101), 42, null]) {
      expect((await alice.call("POST", "/api/projects", { name })).status).toBe(400);
    }
    expect(await alice.listProjects()).toEqual([]);
  });

  it("never shows one User another User's Projects", async () => {
    const alice = await signIn(server.url, "alice@example.com");
    const bob = await signIn(server.url, "bob@example.com");
    const aliceProject = await alice.createProject("Alice only");
    const bobProject = await bob.createProject("Bob only");

    expect(await alice.listProjects()).toEqual([aliceProject]);
    expect(await bob.listProjects()).toEqual([bobProject]);
  });

  it("lets a User open their own Project and hides another User's Project as not found", async () => {
    const alice = await signIn(server.url, "alice@example.com");
    const bob = await signIn(server.url, "bob@example.com");
    const aliceProject = await alice.createProject("Alice only");

    const own = await alice.call("GET", `/api/projects/${aliceProject.id}`);
    expect(own.status).toBe(200);
    expect(await own.json()).toEqual(aliceProject);

    expect((await bob.call("GET", `/api/projects/${aliceProject.id}`)).status).toBe(404);
    expect((await alice.call("GET", "/api/projects/999999")).status).toBe(404);
    expect((await alice.call("GET", "/api/projects/not-a-number")).status).toBe(404);
  });

  it("requires a signed-in User", async () => {
    const alice = await signIn(server.url, "alice@example.com");
    const project = await alice.createProject("Alice only");
    expect((await fetch(`${server.url}/api/projects`)).status).toBe(401);
    expect((await fetch(`${server.url}/api/projects/${project.id}`)).status).toBe(401);
    expect(
      (await fetch(`${server.url}/api/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Sneaky" }),
      })).status,
    ).toBe(401);
  });

  it("requires the CSRF token to create a Project", async () => {
    const alice = await signIn(server.url, "alice@example.com");
    expect((await alice.call("POST", "/api/projects", { name: "No token" }, false)).status).toBe(403);
    expect(await alice.listProjects()).toEqual([]);
  });
});
