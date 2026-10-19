import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { users } from "./collections";
import { readSession } from "./session";

/**
 * Server-side hashing of the client-derived auth key.
 *
 * The client sends an already high-entropy `authKey` (Argon2id of the password
 * with the auth salt). We still run it through scrypt with a random per-user
 * salt so that a database leak does not hand an attacker the verifier material
 * directly. `authKey` is treated as an opaque password string.
 */
export function hashAuthKey(authKey: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(authKey, salt, 32);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyAuthKey(authKey: string, verifier: string): boolean {
  const [scheme, saltB64, hashB64] = verifier.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const derived = scryptSync(authKey, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** The single-user app's account, or null before `/setup` has run. */
export async function getSingleUser() {
  return (await users()).findOne({}, { sort: { createdAt: 1 } });
}

/**
 * Resolve the authenticated user id for a route handler, or return a 401
 * response the caller should return directly.
 */
export async function requireUserId(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await readSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, userId: session.userId };
}
