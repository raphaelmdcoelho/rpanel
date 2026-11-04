import { startServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
const databasePath = process.env.DATABASE_PATH ?? "./data/rpanel.sqlite";

const server = await startServer({ port, databasePath, host: "0.0.0.0" });
console.log(`rpanel api listening on ${server.url}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void server.close().then(() => process.exit(0)));
}
