import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const COST = 65536;
const BLOCK_SIZE = 8;
const PARALLELISM = 2;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, cost: number, blockSize: number, parallelism: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: cost, r: blockSize, p: parallelism, maxmem: 128 * cost * blockSize * 2 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM);
  return ["scrypt", COST, BLOCK_SIZE, PARALLELISM, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, blockSize, parallelism, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !cost || !blockSize || !parallelism || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(cost), Number(blockSize), Number(parallelism));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A real hash of a throwaway value, so an unknown email costs the same time as a wrong password.
export const DUMMY_HASH = await hashPassword(randomBytes(16).toString("hex"));
