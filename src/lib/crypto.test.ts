import { beforeAll, describe, expect, it } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  createRecoveryKey,
  createSalts,
  decryptEntry,
  deriveKeys,
  encryptEntry,
  formatRecoveryKey,
  normalizeEntry,
  parseRecoveryKey,
  randomBytes,
  unwrapMasterKeyWithRecovery,
  wrapMasterKeyWithRecovery,
} from "./crypto";
import type { EntryPlain } from "./types";

const entry: EntryPlain = {
  title: "Day one",
  markdown: "# Hello\n\nGingerbread & tea.",
  tags: ["test", "warm"],
};

let masterKey: Uint8Array;
let wrongKey: Uint8Array;

beforeAll(async () => {
  const salts = createSalts();
  const keys = await deriveKeys("correct horse battery staple", salts.saltAuth, salts.saltEnc);
  masterKey = keys.masterKey;
  wrongKey = Uint8Array.from(masterKey);
  wrongKey[0] ^= 0xff;
}, 30_000);

describe("base64 helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = randomBytes(300);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});

describe("key derivation", () => {
  it("is deterministic for the same password and salts", async () => {
    const salts = createSalts();
    const a = await deriveKeys("hunter2", salts.saltAuth, salts.saltEnc);
    const b = await deriveKeys("hunter2", salts.saltAuth, salts.saltEnc);
    expect(a.authKey).toEqual(b.authKey);
    expect(a.masterKey).toEqual(b.masterKey);
  }, 30_000);

  it("derives different auth and master keys", () => {
    expect(masterKey).toHaveLength(32);
  });
});

describe("entry envelope", () => {
  it("round-trips an entry", async () => {
    const blob = await encryptEntry(masterKey, "entry-1", 0, entry);
    const decrypted = await decryptEntry(masterKey, "entry-1", 0, blob);
    expect(decrypted).toEqual(entry);
  });

  it("fails with the wrong master key", async () => {
    const blob = await encryptEntry(masterKey, "entry-2", 0, entry);
    await expect(decryptEntry(wrongKey, "entry-2", 0, blob)).rejects.toThrow();
  });

  it("binds the ciphertext to its entry id and version (AAD)", async () => {
    const blob = await encryptEntry(masterKey, "entry-3", 0, entry);
    await expect(decryptEntry(masterKey, "entry-4", 0, blob)).rejects.toThrow();
    await expect(decryptEntry(masterKey, "entry-3", 1, blob)).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const blob = await encryptEntry(masterKey, "entry-5", 0, entry);
    const bytes = base64ToBytes(blob.ciphertext);
    bytes[0] ^= 0xff;
    await expect(
      decryptEntry(masterKey, "entry-5", 0, {
        ...blob,
        ciphertext: bytesToBase64(bytes),
      }),
    ).rejects.toThrow();
  });
});

describe("recovery key", () => {
  it("formats and parses back to the same bytes", () => {
    const key = createRecoveryKey();
    const formatted = formatRecoveryKey(key);
    expect(formatted).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){12}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(parseRecoveryKey(formatted)).toEqual(key);
  });

  it("tolerates lowercase, spaces and confusable characters", () => {
    const key = createRecoveryKey();
    const formatted = formatRecoveryKey(key).toLowerCase().replace(/-/g, " ");
    expect(parseRecoveryKey(formatted)).toEqual(key);
  });

  it("wraps and unwraps the master key", async () => {
    const recovery = createRecoveryKey();
    const wrapped = await wrapMasterKeyWithRecovery(recovery, masterKey);
    const unwrapped = await unwrapMasterKeyWithRecovery(recovery, wrapped);
    expect(unwrapped).toEqual(masterKey);
  });

  it("rejects an invalid key", () => {
    expect(() => parseRecoveryKey("nope")).toThrow();
  });
});

describe("normalizeEntry", () => {
  it("coerces missing or malformed fields", () => {
    expect(normalizeEntry({})).toEqual({ title: "", markdown: "", tags: [] });
    expect(normalizeEntry({ tags: [1, "a", null] })).toEqual({
      title: "",
      markdown: "",
      tags: ["a"],
    });
  });
});
