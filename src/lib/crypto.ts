/**
 * Browser-side zero-knowledge crypto.
 *
 * Nothing here may import Node-only modules: this file runs in the browser (and
 * under Node 20+ in tests, where WebCrypto is available). The server never sees
 * the password, the master key, or any plaintext.
 */
import { argon2id } from "hash-wasm";
import {
  ARGON2,
  IV_BYTES,
  KEY_BYTES,
  PBKDF2,
  SALT_BYTES,
  type Kdf,
} from "./constants";
import type { EncryptedBlob, EntryPlain } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x2000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * WebCrypto's `BufferSource` is typed more strictly than TypeScript's default
 * `Uint8Array` generic, so views handed to `crypto.subtle` are narrowed here.
 */
const buf = (bytes: Uint8Array): BufferSource => bytes as unknown as BufferSource;

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Best-effort wipe of key material once it is no longer needed. */
export function zeroize(...arrays: Uint8Array[]): void {
  for (const array of arrays) array.fill(0);
}

// ---------------------------------------------------------------------------
// Key derivation (split derivation per PLAN.md §5)
// ---------------------------------------------------------------------------

export interface DerivedKeys {
  /** Sent to the server as proof of knowledge (as base64). */
  authKey: Uint8Array;
  /** Never leaves the browser; decrypts entries. */
  masterKey: Uint8Array;
  /** Which KDF was used; stamped on the account so unlock stays consistent. */
  kdf: Kdf;
}

async function argon2Derive(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  return argon2id({
    password,
    salt,
    parallelism: ARGON2.parallelism,
    iterations: ARGON2.iterations,
    memorySize: ARGON2.memorySize,
    hashLength: ARGON2.hashLength,
    outputType: "binary",
  });
}

async function derive(
  password: string,
  salt: Uint8Array,
  kdf: Kdf,
): Promise<Uint8Array> {
  if (kdf === "pbkdf2") return pbkdf2Fallback(password, salt);
  try {
    return await argon2Derive(password, salt);
  } catch {
    // Never fall back silently: a different KDF yields a different master key.
    throw new Error(
      "This browser cannot run Argon2id, which this journal requires.",
    );
  }
}

async function pbkdf2Fallback(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: buf(salt),
      iterations: PBKDF2.iterations,
      hash: "SHA-256",
    },
    material,
    PBKDF2.hashLength * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Derive both keys from the password and the two public salts.
 *
 * At setup, omit `kdf`: we probe Argon2id once and record whichever KDF the
 * environment can actually run. At unlock, pass the account's stored `kdf` so
 * the derivation is identical.
 */
export async function deriveKeys(
  password: string,
  saltAuthB64: string,
  saltEncB64: string,
  kdf?: Kdf,
): Promise<DerivedKeys> {
  const saltAuth = base64ToBytes(saltAuthB64);
  const saltEnc = base64ToBytes(saltEncB64);

  let chosen: Kdf;
  if (kdf) {
    chosen = kdf;
  } else {
    try {
      await argon2Derive(password, saltAuth);
      chosen = "argon2id";
    } catch {
      chosen = "pbkdf2";
    }
  }

  const [authKey, masterKey] = await Promise.all([
    derive(password, saltAuth, chosen),
    derive(password, saltEnc, chosen),
  ]);
  return { authKey, masterKey, kdf: chosen };
}

/** Fresh random salts for a new account, ready to store. */
export function createSalts(): { saltAuth: string; saltEnc: string } {
  return {
    saltAuth: bytesToBase64(randomBytes(SALT_BYTES)),
    saltEnc: bytesToBase64(randomBytes(SALT_BYTES)),
  };
}

// ---------------------------------------------------------------------------
// AES-256-GCM primitives
// ---------------------------------------------------------------------------

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", buf(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function aesGcmEncrypt(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): Promise<Uint8Array> {
  const key = await importAesKey(keyBytes);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: buf(iv), additionalData: aad ? buf(aad) : undefined },
    key,
    buf(plaintext),
  );
  return new Uint8Array(ciphertext);
}

export async function aesGcmDecrypt(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array,
): Promise<Uint8Array> {
  const key = await importAesKey(keyBytes);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buf(iv), additionalData: aad ? buf(aad) : undefined },
    key,
    buf(ciphertext),
  );
  return new Uint8Array(plaintext);
}

// ---------------------------------------------------------------------------
// Entry envelope: master key wraps a per-entry data key (PLAN.md §5)
// ---------------------------------------------------------------------------

function entryKeyAad(entryId: string): Uint8Array {
  return encoder.encode(`entry-key:${entryId}`);
}

async function wrapDataKey(
  masterKey: Uint8Array,
  dataKey: Uint8Array,
  entryId: string,
): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const wrapped = await aesGcmEncrypt(
    masterKey,
    iv,
    dataKey,
    entryKeyAad(entryId),
  );
  return bytesToBase64(concat(iv, wrapped));
}

async function unwrapDataKey(
  masterKey: Uint8Array,
  wrappedKeyB64: string,
  entryId: string,
): Promise<Uint8Array> {
  const raw = base64ToBytes(wrappedKeyB64);
  const iv = raw.subarray(0, IV_BYTES);
  const wrapped = raw.subarray(IV_BYTES);
  return aesGcmDecrypt(masterKey, iv, wrapped, entryKeyAad(entryId));
}

function entryAad(entryId: string, version: number): Uint8Array {
  return encoder.encode(`${entryId}:${version}`);
}

/** Encrypt one entry version into a storable ciphertext envelope. */
export async function encryptEntry(
  masterKey: Uint8Array,
  entryId: string,
  version: number,
  plain: EntryPlain,
): Promise<EncryptedBlob> {
  const dataKey = randomBytes(KEY_BYTES);
  const iv = randomBytes(IV_BYTES);
  try {
    const ciphertext = await aesGcmEncrypt(
      dataKey,
      iv,
      encoder.encode(JSON.stringify(plain)),
      entryAad(entryId, version),
    );
    const wrappedKey = await wrapDataKey(masterKey, dataKey, entryId);
    return {
      iv: bytesToBase64(iv),
      wrappedKey,
      ciphertext: bytesToBase64(ciphertext),
    };
  } finally {
    zeroize(dataKey);
  }
}

/** Decrypt a single entry version. Throws if the master key or AAD is wrong. */
export async function decryptEntry(
  masterKey: Uint8Array,
  entryId: string,
  version: number,
  blob: EncryptedBlob,
): Promise<EntryPlain> {
  const dataKey = await unwrapDataKey(masterKey, blob.wrappedKey, entryId);
  try {
    const plaintext = await aesGcmDecrypt(
      dataKey,
      base64ToBytes(blob.iv),
      base64ToBytes(blob.ciphertext),
      entryAad(entryId, version),
    );
    return normalizeEntry(JSON.parse(decoder.decode(plaintext)));
  } finally {
    zeroize(dataKey);
  }
}

/** Coerce decrypted JSON into a known shape (defensive against old data). */
export function normalizeEntry(value: unknown): EntryPlain {
  const record = (value ?? {}) as Record<string, unknown>;
  return {
    title: typeof record.title === "string" ? record.title : "",
    markdown: typeof record.markdown === "string" ? record.markdown : "",
    tags: Array.isArray(record.tags)
      ? record.tags.filter((t): t is string => typeof t === "string")
      : [],
  };
}

// ---------------------------------------------------------------------------
// Recovery key (PLAN.md §12): 32 random bytes, Crockford base32 for humans.
// ---------------------------------------------------------------------------

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Encode 32 bytes as a grouped, transcription-friendly string. */
export function formatRecoveryKey(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out.match(/.{1,4}/g)!.join("-");
}

/** Parse a (possibly mistyped) recovery key back into 32 bytes. */
export function parseRecoveryKey(input: string): Uint8Array {
  const clean = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = CROCKFORD.indexOf(char);
    if (index < 0) throw new Error("Invalid recovery key character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  const bytes = new Uint8Array(out);
  if (bytes.length !== KEY_BYTES) {
    throw new Error("Recovery key must encode exactly 32 bytes");
  }
  return bytes;
}

/** Generate a fresh recovery key. */
export function createRecoveryKey(): Uint8Array {
  return randomBytes(KEY_BYTES);
}

export async function wrapMasterKeyWithRecovery(
  recoveryKey: Uint8Array,
  masterKey: Uint8Array,
): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const wrapped = await aesGcmEncrypt(
    recoveryKey,
    iv,
    masterKey,
    encoder.encode("recovery"),
  );
  return bytesToBase64(concat(iv, wrapped));
}

export async function unwrapMasterKeyWithRecovery(
  recoveryKey: Uint8Array,
  wrappedB64: string,
): Promise<Uint8Array> {
  const raw = base64ToBytes(wrappedB64);
  const iv = raw.subarray(0, IV_BYTES);
  const wrapped = raw.subarray(IV_BYTES);
  return aesGcmDecrypt(recoveryKey, iv, wrapped, encoder.encode("recovery"));
}

/**
 * A one-way proof derived from a recovery key. The server can verify this to
 * grant a session without ever seeing (or being able to derive) the recovery
 * key itself, preserving zero-knowledge recovery.
 */
export async function recoveryProof(recoveryKey: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf(recoveryKey));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
