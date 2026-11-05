import type { Database } from "./db.js";
import { hashPassword } from "./passwords.js";

export type NewUser = { email: string; password: string; isAdmin?: boolean };

// Direct account creation for bootstrapping and tests. Real Users join through setup and, later, Invites.
export async function createUser(database: Database, now: () => number, user: NewUser): Promise<number> {
  const passwordHash = await hashPassword(user.password);
  const row = database
    .prepare("INSERT INTO users (email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?) RETURNING id")
    .get(user.email.trim().toLowerCase(), passwordHash, user.isAdmin ? 1 : 0, now()) as { id: number };
  return row.id;
}
