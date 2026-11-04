import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type RunningServer } from "../src/server.js";

const PASSWORD = "correct horse battery";
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

type Client = ReturnType<typeof makeClient>;

function makeClient(baseUrl: string) {
  let cookie = "";
  let csrf = "";
  return {
    get cookie() { return cookie; },
    set csrf(value: string) { csrf = value; },
    async call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
      const headers: Record<string, string> = { ...extra };
      if (body !== undefined) headers["content-type"] = "application/json";
      if (cookie) headers.cookie = cookie;
      const res = await fetch(`${baseUrl}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual",
      });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0] ?? "";
      return res;
    },
    withCsrf(path: string, method = "POST", body?: unknown) {
      return this.call(method, path, body, { "x-csrf-token": csrf });
    },
  };
}

describe("authentication", () => {
  let dir: string;
  let server: RunningServer;
  let now: number;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "rpanel-test-"));
    now = Date.UTC(2026, 0, 1);
    server = await startServer({ port: 0, databasePath: join(dir, "test.sqlite"), now: () => now });
  });

  afterEach(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function setupAdmin(client: Client = makeClient(server.url)) {
    const res = await client.call("POST", "/api/setup", { email: "admin@example.com", password: PASSWORD });
    return { client, res };
  }

  describe("first-run setup", () => {
    it("reports that setup is needed on a fresh panel and not after", async () => {
      const client = makeClient(server.url);
      expect(await (await client.call("GET", "/api/setup/status")).json()).toEqual({ needsSetup: true });
      await setupAdmin(client);
      expect(await (await client.call("GET", "/api/setup/status")).json()).toEqual({ needsSetup: false });
    });

    it("makes the first account the Admin and signs them in", async () => {
      const { client, res } = await setupAdmin();
      expect(res.status).toBe(201);
      const me = await client.call("GET", "/api/me");
      expect(me.status).toBe(200);
      expect(await me.json()).toMatchObject({ user: { email: "admin@example.com", isAdmin: true } });
    });

    it("refuses setup once an account exists, so no later account can claim Admin", async () => {
      await setupAdmin();
      const res = await makeClient(server.url).call("POST", "/api/setup", { email: "evil@example.com", password: PASSWORD });
      expect(res.status).toBe(409);
      const login = await makeClient(server.url).call("POST", "/api/login", { email: "evil@example.com", password: PASSWORD });
      expect(login.status).toBe(401);
    });

    it("rejects a weak password and an invalid email", async () => {
      const client = makeClient(server.url);
      expect((await client.call("POST", "/api/setup", { email: "admin@example.com", password: "short" })).status).toBe(400);
      expect((await client.call("POST", "/api/setup", { email: "not-an-email", password: PASSWORD })).status).toBe(400);
      expect(await (await client.call("GET", "/api/setup/status")).json()).toEqual({ needsSetup: true });
    });
  });

  describe("login and logout", () => {
    it("logs in with a secure HttpOnly SameSite session cookie", async () => {
      await setupAdmin();
      const res = await makeClient(server.url).call("POST", "/api/login", { email: "admin@example.com", password: PASSWORD });
      expect(res.status).toBe(200);
      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toMatch(/^rpanel_session=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\//i);
      expect(cookie).toMatch(/Max-Age=\d+/i);
    });

    it("marks the cookie Secure when the request came in over HTTPS", async () => {
      await setupAdmin();
      const res = await makeClient(server.url).call(
        "POST", "/api/login", { email: "admin@example.com", password: PASSWORD }, { "x-forwarded-proto": "https" },
      );
      expect(res.headers.get("set-cookie") ?? "").toMatch(/Secure/i);
    });

    it("rejects a wrong password and an unknown email with the same answer", async () => {
      await setupAdmin();
      const wrong = await makeClient(server.url).call("POST", "/api/login", { email: "admin@example.com", password: "nope nope nope" });
      const unknown = await makeClient(server.url).call("POST", "/api/login", { email: "ghost@example.com", password: PASSWORD });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(await wrong.json()).toEqual(await unknown.json());
    });

    it("treats email case-insensitively", async () => {
      await setupAdmin();
      const res = await makeClient(server.url).call("POST", "/api/login", { email: "ADMIN@Example.com", password: PASSWORD });
      expect(res.status).toBe(200);
    });

    it("requires a session for /api/me", async () => {
      expect((await makeClient(server.url).call("GET", "/api/me")).status).toBe(401);
    });

    it("ends the session on logout", async () => {
      const { client, res } = await setupAdmin();
      client.csrf = ((await res.json()) as { csrfToken: string }).csrfToken;
      expect((await client.withCsrf("/api/logout")).status).toBe(204);
      expect((await client.call("GET", "/api/me")).status).toBe(401);
    });

    it("expires a session after 7 days", async () => {
      const { client } = await setupAdmin();
      now += 6 * DAY;
      expect((await client.call("GET", "/api/me")).status).toBe(200);
      now += 2 * DAY;
      expect((await client.call("GET", "/api/me")).status).toBe(401);
    });

    it("ignores a forged or tampered session cookie", async () => {
      await setupAdmin();
      const client = makeClient(server.url);
      const res = await fetch(`${server.url}/api/me`, { headers: { cookie: "rpanel_session=not-a-real-token" } });
      expect(res.status).toBe(401);
      expect(client.cookie).toBe("");
    });
  });

  describe("lockout", () => {
    async function failLogins(times: number) {
      for (let i = 0; i < times; i++) {
        await makeClient(server.url).call("POST", "/api/login", { email: "admin@example.com", password: "wrong password" });
      }
    }

    it("locks the account after repeated failures, even for the right password, without revealing the lock", async () => {
      await setupAdmin();
      await failLogins(5);
      const locked = await makeClient(server.url).call("POST", "/api/login", { email: "admin@example.com", password: PASSWORD });
      const unknown = await makeClient(server.url).call("POST", "/api/login", { email: "ghost@example.com", password: PASSWORD });
      expect(locked.status).toBe(401);
      expect(locked.headers.get("set-cookie")).toBeNull();
      expect(await locked.json()).toEqual(await unknown.json());
    });

    it("lets the User back in once the lock has passed", async () => {
      await setupAdmin();
      await failLogins(5);
      now += 16 * MINUTE;
      const res = await makeClient(server.url).call("POST", "/api/login", { email: "admin@example.com", password: PASSWORD });
      expect(res.status).toBe(200);
    });

    it("does not lock the account after fewer failures, and a good login resets the count", async () => {
      await setupAdmin();
      await failLogins(4);
      expect((await makeClient(server.url).call("POST", "/api/login", { email: "admin@example.com", password: PASSWORD })).status).toBe(200);
      await failLogins(4);
      expect((await makeClient(server.url).call("POST", "/api/login", { email: "admin@example.com", password: PASSWORD })).status).toBe(200);
    });
  });

  describe("CSRF", () => {
    it("rejects a state-changing request from a signed-in session without a CSRF token", async () => {
      const { client } = await setupAdmin();
      expect((await client.call("POST", "/api/logout")).status).toBe(403);
      expect((await client.call("GET", "/api/me")).status).toBe(200);
    });

    it("rejects a wrong CSRF token", async () => {
      const { client } = await setupAdmin();
      client.csrf = "wrong";
      expect((await client.withCsrf("/api/logout")).status).toBe(403);
    });

    it("rejects a cross-site Origin on login", async () => {
      await setupAdmin();
      const res = await makeClient(server.url).call(
        "POST", "/api/login", { email: "admin@example.com", password: PASSWORD }, { origin: "https://evil.example" },
      );
      expect(res.status).toBe(403);
    });

    it("accepts a same-site Origin on login", async () => {
      await setupAdmin();
      const res = await makeClient(server.url).call(
        "POST", "/api/login", { email: "admin@example.com", password: PASSWORD }, { origin: server.url },
      );
      expect(res.status).toBe(200);
    });

    it("rejects a login sent as a form post instead of JSON", async () => {
      await setupAdmin();
      const res = await fetch(`${server.url}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "email=admin@example.com&password=" + encodeURIComponent(PASSWORD),
      });
      expect(res.status).toBe(415);
    });
  });

  describe("security headers", () => {
    it("sets them on API responses", async () => {
      const res = await fetch(`${server.url}/api/health`);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
      expect(res.headers.get("cache-control")).toBe("no-store");
    });
  });
});
