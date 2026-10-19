import { randomUUID } from "node:crypto";
import type { EntryDoc, EntryRevisionDoc } from "./collections";
import { entries, ensureIndexes, entryRevisions } from "./collections";
import { MAX_REVISIONS } from "./constants";
import type { CreateEntryInput, UpdateEntryInput } from "./validation";

/** The wire shape sent to the browser. Never contains plaintext. */
export interface EntryPayload {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  cryptoVersion: number;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

function toPayload(doc: EntryDoc): EntryPayload {
  return {
    id: doc._id,
    date: doc.date,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    version: doc.version,
    cryptoVersion: doc.cryptoVersion,
    iv: doc.iv,
    wrappedKey: doc.wrappedKey,
    ciphertext: doc.ciphertext,
  };
}

let indexesReady: Promise<void> | null = null;
/** Ensure indexes exist once, lazily, before the first entries operation. */
function ensureReady(): Promise<void> {
  indexesReady ??= ensureIndexes();
  return indexesReady;
}

export async function listEntries(userId: string): Promise<EntryPayload[]> {
  await ensureReady();
  const docs = await (await entries())
    .find({ userId }, { projection: { userId: 0 } })
    .sort({ date: -1, updatedAt: -1 })
    .toArray();
  return docs.map(toPayload);
}

export async function createEntry(
  userId: string,
  input: CreateEntryInput,
): Promise<EntryPayload> {
  await ensureReady();
  const now = new Date();
  const doc: EntryDoc = {
    _id: input.id,
    userId,
    date: input.date,
    createdAt: now,
    updatedAt: now,
    version: input.version ?? 0,
    cryptoVersion: input.cryptoVersion,
    iv: input.iv,
    wrappedKey: input.wrappedKey,
    ciphertext: input.ciphertext,
  };
  await (await entries()).insertOne(doc);
  return toPayload(doc);
}

export type UpdateResult =
  | { ok: true; entry: EntryPayload }
  | { ok: false; reason: "not-found" | "conflict" };

export async function updateEntry(
  userId: string,
  id: string,
  input: UpdateEntryInput,
): Promise<UpdateResult> {
  await ensureReady();
  const collection = await entries();
  const current = await collection.findOne({ _id: id, userId });
  if (!current) return { ok: false, reason: "not-found" };
  if (input.version !== current.version + 1) {
    return { ok: false, reason: "conflict" };
  }

  // Snapshot the outgoing version for undo, then keep only the newest N.
  const revision: EntryRevisionDoc = {
    _id: randomUUID(),
    entryId: current._id,
    userId,
    version: current.version,
    createdAt: current.updatedAt,
    cryptoVersion: current.cryptoVersion,
    iv: current.iv,
    wrappedKey: current.wrappedKey,
    ciphertext: current.ciphertext,
  };
  const revisions = await entryRevisions();
  await revisions.insertOne(revision);

  const stale = await revisions
    .find({ entryId: id, userId }, { projection: { _id: 1 } })
    .sort({ version: -1 })
    .skip(MAX_REVISIONS)
    .toArray();
  if (stale.length > 0) {
    await revisions.deleteMany({ _id: { $in: stale.map((r) => r._id) } });
  }

  const updatedAt = new Date();
  const updated: EntryDoc = {
    ...current,
    date: input.date ?? current.date,
    updatedAt,
    version: input.version,
    cryptoVersion: input.cryptoVersion,
    iv: input.iv,
    wrappedKey: input.wrappedKey,
    ciphertext: input.ciphertext,
  };
  await collection.replaceOne({ _id: id, userId }, updated);
  return { ok: true, entry: toPayload(updated) };
}

export async function deleteEntry(
  userId: string,
  id: string,
): Promise<boolean> {
  await ensureReady();
  const result = await (await entries()).deleteOne({ _id: id, userId });
  await (await entryRevisions()).deleteMany({ entryId: id, userId });
  return result.deletedCount === 1;
}

export async function listRevisions(
  userId: string,
  entryId: string,
): Promise<EntryPayload[]> {
  await ensureReady();
  const docs = await (await entryRevisions())
    .find({ entryId, userId }, { projection: { userId: 0, entryId: 0 } })
    .sort({ version: -1 })
    .toArray();
  return docs.map((d) =>
    toPayload({
      _id: entryId,
      userId,
      date: "",
      createdAt: d.createdAt,
      updatedAt: d.createdAt,
      version: d.version,
      cryptoVersion: d.cryptoVersion,
      iv: d.iv,
      wrappedKey: d.wrappedKey,
      ciphertext: d.ciphertext,
    }),
  );
}
