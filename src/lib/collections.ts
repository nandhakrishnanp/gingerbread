import type { Collection } from "mongodb";
import type { Kdf } from "./constants";
import { getDb } from "./mongodb";

/**
 * A user. Every field here is ciphertext or opaque metadata — the server never
 * holds the master key or any plaintext entry content.
 */
export interface UserDoc {
  _id: string; // userId (random uuid)
  saltAuth: string; // base64 salt for deriving the auth key
  saltEnc: string; // base64 salt for deriving the encryption (master) key
  authVerifier: string; // server-side hash of the client's derived auth key
  kdf: Kdf; // password KDF used at setup, re-used at unlock
  cryptoVersion: number; // algorithm version stamped for future migrations
  recoveryWrappedMasterKey?: string; // master key wrapped by the recovery key
  recoveryAuthVerifier?: string; // server hash of the recovery proof (never the key)
  createdAt: Date;
}

/** An encrypted journal entry. */
export interface EntryDoc {
  _id: string; // entryId (random uuid)
  userId: string;
  date: string; // the journal day, ISO date (YYYY-MM-DD)
  createdAt: Date;
  updatedAt: Date;
  version: number; // bumped on every write; used for last-write-wins
  cryptoVersion: number;
  iv: string; // base64 AES-GCM IV
  wrappedKey: string; // per-entry data key, wrapped by the master key
  ciphertext: string; // base64 AES-GCM ciphertext of the entry JSON
}

/**
 * An encrypted vault item. `kind` is the only piece of metadata that reveals
 * what a blob is (a thought or a habit); its content stays ciphertext.
 */
export interface VaultDoc {
  _id: string; // random uuid
  userId: string;
  kind: "thought" | "habit";
  createdAt: Date;
  updatedAt: Date;
  version: number;
  cryptoVersion: number;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

/** A prior revision of an entry, kept for undo (last ~10 per entry). */
export interface EntryRevisionDoc {
  _id: string;
  entryId: string;
  userId: string;
  version: number;
  createdAt: Date;
  cryptoVersion: number;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

export async function users(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>("users");
}

export async function entries(): Promise<Collection<EntryDoc>> {
  return (await getDb()).collection<EntryDoc>("entries");
}

export async function entryRevisions(): Promise<Collection<EntryRevisionDoc>> {
  return (await getDb()).collection<EntryRevisionDoc>("entry_revisions");
}

export async function vaultRecords(): Promise<Collection<VaultDoc>> {
  return (await getDb()).collection<VaultDoc>("vault_records");
}

/** Create the indexes the app relies on. Safe to call repeatedly. */
export async function ensureIndexes(): Promise<void> {
  const [entriesCol, revisionsCol, vaultCol] = await Promise.all([
    entries(),
    entryRevisions(),
    vaultRecords(),
  ]);
  await entriesCol.createIndex({ userId: 1, date: -1 });
  await revisionsCol.createIndex({ entryId: 1, version: -1 });
  await vaultCol.createIndex({ userId: 1, kind: 1, createdAt: -1 });
}
