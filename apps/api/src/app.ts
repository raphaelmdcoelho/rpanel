import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { HealthResponse } from "@rpanel/shared";
import { createAuth } from "./auth.js";
import type { Database } from "./db.js";
import { createProjectRoutes } from "./projects.js";

export type AppDependencies = { database: Database; now: () => number };

export function createApp({ database, now }: AppDependencies): Hono {
  const app = new Hono();
  const auth = createAuth(database, now);

  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      xFrameOptions: "DENY",
      referrerPolicy: "no-referrer",
    }),
  );
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  app.use("/api/*", auth.requestGuard);

  app.get("/api/health", (c) => {
    database.prepare("SELECT 1").get();
    const body: HealthResponse = { status: "ok", database: "ok" };
    return c.json(body);
  });
  app.route("/", auth.routes);
  app.route("/", createProjectRoutes(database, now, auth.requireSession));

  return app;
}
