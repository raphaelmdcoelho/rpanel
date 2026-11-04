import { serve } from "@hono/node-server";
import type { AddressInfo } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Hono } from "hono";
import type { HealthResponse } from "@rpanel/shared";

export type ServerOptions = { port: number; databasePath: string; host?: string };
export type RunningServer = { url: string; close: () => Promise<void> };

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  mkdirSync(dirname(options.databasePath), { recursive: true });
  const database = new DatabaseSync(options.databasePath);

  const app = new Hono();
  app.get("/api/health", (c) => {
    database.prepare("SELECT 1").get();
    const body: HealthResponse = { status: "ok", database: "ok" };
    return c.json(body);
  });

  const host = options.host ?? "127.0.0.1";
  const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
    const s = serve({ fetch: app.fetch, port: options.port, hostname: host }, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          database.close();
          err ? reject(err) : resolve();
        });
      }),
  };
}
