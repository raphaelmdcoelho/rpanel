import { Hono, type MiddlewareHandler } from "hono";
import type { Project } from "@rpanel/shared";
import type { AuthVariables } from "./auth.js";
import type { Database } from "./db.js";

const MAX_NAME_LENGTH = 100;

type ProjectRow = { id: number; name: string; created_at: number };

const toProject = (row: ProjectRow): Project => ({ id: row.id, name: row.name, createdAt: row.created_at });

export function createProjectRoutes(
  database: Database,
  now: () => number,
  requireSession: MiddlewareHandler<{ Variables: AuthVariables }>,
) {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("/api/projects", requireSession);
  routes.use("/api/projects/*", requireSession);

  routes.get("/api/projects", (c) => {
    const { userId } = c.get("auth");
    const rows = database
      .prepare("SELECT id, name, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC, id DESC")
      .all(userId) as ProjectRow[];
    return c.json({ projects: rows.map(toProject) });
  });

  routes.post("/api/projects", async (c) => {
    const { userId } = c.get("auth");
    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
      return c.json({ error: `Project name must be 1 to ${MAX_NAME_LENGTH} characters` }, 400);
    }
    const row = database
      .prepare("INSERT INTO projects (user_id, name, created_at) VALUES (?, ?, ?) RETURNING id, name, created_at")
      .get(userId, name, now()) as ProjectRow;
    return c.json(toProject(row), 201);
  });

  routes.get("/api/projects/:id", (c) => {
    const { userId } = c.get("auth");
    const id = c.req.param("id");
    const notFound = () => c.json({ error: "Project not found" }, 404);
    if (!/^\d+$/.test(id)) return notFound();
    const row = database
      .prepare("SELECT id, name, created_at FROM projects WHERE id = ? AND user_id = ?")
      .get(Number(id), userId) as ProjectRow | undefined;
    // Someone else's Project is reported as not found, exactly like one that does not exist.
    return row ? c.json(toProject(row)) : notFound();
  });

  return routes;
}
