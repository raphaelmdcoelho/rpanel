import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { SessionInfo } from "@rpanel/shared";
import type { Database } from "./db.js";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./passwords.js";

export const SESSION_COOKIE = "rpanel_session";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type UserRow = { id: number; email: string; password_hash: string; is_admin: number; failed_logins: number; locked_until: number | null };
type SessionRow = { user_id: number; csrf_token: string; expires_at: number; email: string; is_admin: number };

export type AuthContext = { userId: number; email: string; isAdmin: boolean; csrfToken: string };
export type AuthVariables = { auth: AuthContext };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH;
}

async function readJson(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json();
    return body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function createAuth(database: Database, now: () => number) {
  function startSession(c: Context, user: { id: number; email: string; isAdmin: boolean }): SessionInfo {
    const token = newToken();
    const csrfToken = newToken();
    const created = now();
    database
      .prepare("INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(hashToken(token), user.id, csrfToken, created, created + SESSION_LIFETIME_MS);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Strict",
      path: "/",
      maxAge: SESSION_LIFETIME_MS / 1000,
      secure: c.req.header("x-forwarded-proto") === "https",
    });
    return { user: { id: user.id, email: user.email, isAdmin: user.isAdmin }, csrfToken };
  }

  function findSession(token: string | undefined): (SessionRow & { token_hash: string }) | null {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const row = database
      .prepare(
        `SELECT s.token_hash, s.user_id, s.csrf_token, s.expires_at, u.email, u.is_admin
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
      )
      .get(tokenHash) as (SessionRow & { token_hash: string }) | undefined;
    if (!row) return null;
    if (row.expires_at <= now()) {
      database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
      return null;
    }
    return row;
  }

  // Same-site and JSON-only checks apply to every state-changing request, signed in or not.
  const requestGuard: MiddlewareHandler = async (c, next) => {
    if (UNSAFE_METHODS.has(c.req.method)) {
      const origin = c.req.header("origin");
      if (origin) {
        let originHost: string | null = null;
        try {
          originHost = new URL(origin).host;
        } catch {
          originHost = null;
        }
        if (originHost !== c.req.header("host")) return c.json({ error: "Cross-site request refused" }, 403);
      }
      const contentType = c.req.header("content-type");
      if (contentType && !contentType.toLowerCase().startsWith("application/json")) {
        return c.json({ error: "Content type must be application/json" }, 415);
      }
    }
    await next();
  };

  // Signed-in session required; state-changing requests also need the session's CSRF token.
  const requireSession: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
    const session = findSession(getCookie(c, SESSION_COOKIE));
    if (!session) return c.json({ error: "Not signed in" }, 401);
    if (UNSAFE_METHODS.has(c.req.method)) {
      const sent = c.req.header("x-csrf-token");
      if (!sent || !safeEqual(sent, session.csrf_token)) return c.json({ error: "Invalid CSRF token" }, 403);
    }
    c.set("auth", { userId: session.user_id, email: session.email, isAdmin: session.is_admin === 1, csrfToken: session.csrf_token });
    await next();
  };

  const routes = new Hono<{ Variables: AuthVariables }>();

  function needsSetup(): boolean {
    const row = database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    return row.count === 0;
  }

  routes.get("/api/setup/status", (c) => c.json({ needsSetup: needsSetup() }));

  routes.post("/api/setup", async (c) => {
    const body = await readJson(c);
    const email = normaliseEmail(body?.email);
    if (!email) return c.json({ error: "A valid email is required" }, 400);
    if (!validPassword(body?.password)) {
      return c.json({ error: `Password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters` }, 400);
    }
    if (!needsSetup()) return c.json({ error: "Setup has already been completed" }, 409);
    const passwordHash = await hashPassword(body.password);
    // One statement, so two simultaneous setups cannot both succeed.
    const inserted = database
      .prepare(
        `INSERT INTO users (email, password_hash, is_admin, created_at)
         SELECT ?, ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM users) RETURNING id`,
      )
      .get(email, passwordHash, now()) as { id: number } | undefined;
    if (!inserted) return c.json({ error: "Setup has already been completed" }, 409);
    return c.json(startSession(c, { id: inserted.id, email, isAdmin: true }), 201);
  });

  routes.post("/api/login", async (c) => {
    const body = await readJson(c);
    const email = normaliseEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password : null;
    const refuse = () => c.json({ error: "Invalid email or password" }, 401);
    if (!email || password === null || password.length > MAX_PASSWORD_LENGTH) return refuse();

    const user = database.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    if (!user) {
      await verifyPassword(password, DUMMY_HASH);
      return refuse();
    }
    if (user.locked_until !== null && user.locked_until > now()) {
      // Same answer and same cost as a wrong password, so a lock does not reveal that the account exists.
      await verifyPassword(password, DUMMY_HASH);
      return refuse();
    }
    if (!(await verifyPassword(password, user.password_hash))) {
      database
        .prepare(
          `UPDATE users SET
             failed_logins = CASE WHEN failed_logins + 1 >= ? THEN 0 ELSE failed_logins + 1 END,
             locked_until = CASE WHEN failed_logins + 1 >= ? THEN ? ELSE locked_until END
           WHERE id = ?`,
        )
        .run(MAX_FAILED_LOGINS, MAX_FAILED_LOGINS, now() + LOCK_DURATION_MS, user.id);
      return refuse();
    }
    database.prepare("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?").run(user.id);
    database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now());
    return c.json(startSession(c, { id: user.id, email: user.email, isAdmin: user.is_admin === 1 }));
  });

  routes.get("/api/me", requireSession, (c) => {
    const { userId, email, isAdmin, csrfToken } = c.get("auth");
    return c.json({ user: { id: userId, email, isAdmin }, csrfToken } satisfies SessionInfo);
  });

  routes.post("/api/logout", requireSession, (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  return { routes, requestGuard, requireSession };
}
