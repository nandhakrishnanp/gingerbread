import type { Collection } from "mongodb";
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
  cryptoVersion: number; // algorithm version stamped for future migrations
  recoveryWrappedMasterKey?: string; // master key wrapped by the recovery key
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

/** Create the indexes the app relies on. Safe to call repeatedly. */
export async function ensureIndexes(): Promise<void> {
  const [entriesCol, revisionsCol] = await Promise.all([
    entries(),
    entryRevisions(),
  ]);
  await entriesCol.createIndex({ userId: 1, date: -1 });
  await revisionsCol.createIndex({ entryId: 1, version: -1 });
}
