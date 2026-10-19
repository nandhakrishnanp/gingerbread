/**
 * Cross-cutting constants shared by the browser crypto layer and the server.
 * Keep this file free of any Node-only or browser-only imports so both sides
 * can use it.
 */

/** Version of the encryption scheme stamped on every user and blob. */
export const CRYPTO_VERSION = 1;

/** Argon2id parameters (see PLAN.md §12). */
export const ARGON2 = {
  memorySize: 64 * 1024, // KiB → 64 MiB
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

/** PBKDF2 fallback when Argon2id/WASM is unavailable. */
export const PBKDF2 = {
  iterations: 600_000,
  hashLength: 32,
} as const;

/**
 * Password-based KDFs we support. The one used to create an account is stamped
 * on the user and re-used at unlock, so a device that cannot run Argon2id can
 * never silently derive a different master key.
 */
export const KDFS = ["argon2id", "pbkdf2"] as const;
export type Kdf = (typeof KDFS)[number];

/** Autosave debounce after the user stops typing (ms). */
export const AUTOSAVE_DEBOUNCE_MS = 800;

/** Idle timeout before the in-memory master key is dropped (ms). */
export const AUTOLOCK_IDLE_MS = 15 * 60 * 1000;

/** How many encrypted revisions to keep per entry. */
export const MAX_REVISIONS = 10;

/** Size in bytes of the salts and keys used throughout. */
export const SALT_BYTES = 16;
export const KEY_BYTES = 32;
export const IV_BYTES = 12;
