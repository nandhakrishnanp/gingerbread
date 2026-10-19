import type { VaultDoc } from "./collections";
import { ensureIndexes, vaultRecords } from "./collections";
import type { CreateVaultInput, UpdateVaultInput } from "./validation";

/** The wire shape for a thought/habit. Never contains plaintext. */
export interface VaultPayload {
  id: string;
  kind: "thought" | "habit";
  createdAt: string;
  updatedAt: string;
  version: number;
  cryptoVersion: number;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

function toPayload(doc: VaultDoc): VaultPayload {
  return {
    id: doc._id,
    kind: doc.kind,
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
function ensureReady(): Promise<void> {
  indexesReady ??= ensureIndexes();
  return indexesReady;
}

export async function listVaultRecords(
  userId: string,
  kind?: "thought" | "habit",
): Promise<VaultPayload[]> {
  await ensureReady();
  const filter = kind ? { userId, kind } : { userId };
  const docs = await (await vaultRecords())
    .find(filter, { projection: { userId: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toPayload);
}

export async function createVaultRecord(
  userId: string,
  input: CreateVaultInput,
): Promise<VaultPayload> {
  await ensureReady();
  const now = new Date();
  const doc: VaultDoc = {
    _id: input.id,
    userId,
    kind: input.kind,
    createdAt: now,
    updatedAt: now,
    version: input.version ?? 0,
    cryptoVersion: input.cryptoVersion,
    iv: input.iv,
    wrappedKey: input.wrappedKey,
    ciphertext: input.ciphertext,
  };
  await (await vaultRecords()).insertOne(doc);
  return toPayload(doc);
}

export type VaultUpdateResult =
  | { ok: true; record: VaultPayload }
  | { ok: false; reason: "not-found" | "conflict" };

export async function updateVaultRecord(
  userId: string,
  id: string,
  input: UpdateVaultInput,
): Promise<VaultUpdateResult> {
  await ensureReady();
  const collection = await vaultRecords();
  const current = await collection.findOne({ _id: id, userId });
  if (!current) return { ok: false, reason: "not-found" };
  if (input.version !== current.version + 1) {
    return { ok: false, reason: "conflict" };
  }

  const updated: VaultDoc = {
    ...current,
    updatedAt: new Date(),
    version: input.version,
    cryptoVersion: input.cryptoVersion,
    iv: input.iv,
    wrappedKey: input.wrappedKey,
    ciphertext: input.ciphertext,
  };
  await collection.replaceOne({ _id: id, userId }, updated);
  return { ok: true, record: toPayload(updated) };
}

export async function deleteVaultRecord(
  userId: string,
  id: string,
): Promise<boolean> {
  await ensureReady();
  const result = await (await vaultRecords()).deleteOne({ _id: id, userId });
  return result.deletedCount === 1;
}
