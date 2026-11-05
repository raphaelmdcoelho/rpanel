import { serve } from "@hono/node-server";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";
import { createUser, type NewUser } from "./users.js";

export type ServerOptions = { port: number; databasePath: string; host?: string; now?: () => number };
export type RunningServer = { url: string; createUser: (user: NewUser) => Promise<number>; close: () => Promise<void> };

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const database = openDatabase(options.databasePath);
  const now = options.now ?? Date.now;
  const app = createApp({ database, now });

  const host = options.host ?? "127.0.0.1";
  const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
    const listening = serve({ fetch: app.fetch, port: options.port, hostname: host }, () => resolve(listening));
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`,
    createUser: (user) => createUser(database, now, user),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          database.close();
          err ? reject(err) : resolve();
        });
      }),
  };
}
