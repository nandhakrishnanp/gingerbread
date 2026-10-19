import { z } from "zod";
import { KDFS } from "./constants";

/** A non-empty base64 blob as produced by the browser crypto layer. */
const b64 = z.string().min(1).max(2_000_000);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export const cryptoVersionSchema = z.number().int().positive();

export const setupSchema = z.object({
  saltAuth: b64,
  saltEnc: b64,
  authKey: z.string().min(1).max(1000),
  kdf: z.enum(KDFS),
  recoveryWrappedMasterKey: b64.optional(),
  recoveryProof: z.string().min(1).max(1000).optional(),
  cryptoVersion: cryptoVersionSchema,
});

export const loginSchema = z.object({
  authKey: z.string().min(1).max(1000),
});

export const recoverSchema = z.object({
  proof: z.string().min(1).max(1000),
});

export const createEntrySchema = z.object({
  id: z.string().uuid(),
  date: isoDate,
  version: z.number().int().nonnegative().optional(),
  cryptoVersion: cryptoVersionSchema,
  iv: b64,
  wrappedKey: b64,
  ciphertext: b64,
});

export const updateEntrySchema = z.object({
  version: z.number().int().nonnegative(),
  date: isoDate.optional(),
  cryptoVersion: cryptoVersionSchema,
  iv: b64,
  wrappedKey: b64,
  ciphertext: b64,
});

export const vaultKindSchema = z.enum(["thought", "habit"]);

export const createVaultSchema = z.object({
  id: z.string().uuid(),
  kind: vaultKindSchema,
  version: z.number().int().nonnegative().optional(),
  cryptoVersion: cryptoVersionSchema,
  iv: b64,
  wrappedKey: b64,
  ciphertext: b64,
});

export const updateVaultSchema = z.object({
  version: z.number().int().nonnegative(),
  cryptoVersion: cryptoVersionSchema,
  iv: b64,
  wrappedKey: b64,
  ciphertext: b64,
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type CreateVaultInput = z.infer<typeof createVaultSchema>;
export type UpdateVaultInput = z.infer<typeof updateVaultSchema>;
