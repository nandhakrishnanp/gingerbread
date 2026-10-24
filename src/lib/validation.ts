import { z } from "zod";
import { KDFS } from "./constants";
import { EXPENSE_CATEGORY_KEYS, categoriesFor } from "./expenses";
import { EXPENSE_KINDS, PAYMENT_METHODS } from "./types";

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

// ---------------------------------------------------------------------------
// Plaintext money records
// ---------------------------------------------------------------------------

/** ₹1,000,000,000 in paise — a generous ceiling that still fits safely. */
const MAX_AMOUNT = 100_000_000_000;

const monthKey = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Expected a YYYY-MM month");

const expenseFields = {
  date: isoDate,
  kind: z.enum(EXPENSE_KINDS),
  amount: z.number().int().positive().max(MAX_AMOUNT),
  category: z.string().min(1).max(32),
  payment: z.enum(PAYMENT_METHODS).default("other"),
  note: z.string().max(200).default(""),
};

function checkCategory(
  data: { kind: (typeof EXPENSE_KINDS)[number]; category: string },
  ctx: z.RefinementCtx,
) {
  if (!categoriesFor(data.kind).includes(data.category)) {
    ctx.addIssue({
      code: "custom",
      path: ["category"],
      message: "Unknown category",
    });
  }
}

export const createExpenseSchema = z
  .object({
    id: z.string().uuid(),
    ...expenseFields,
  })
  .superRefine(checkCategory);

export const updateExpenseSchema = z
  .object(expenseFields)
  .superRefine(checkCategory);

export const upsertBudgetSchema = z
  .object({
    month: monthKey,
    total: z.number().int().nonnegative().max(MAX_AMOUNT),
    categories: z.record(
      z.string().min(1).max(32),
      z.number().int().nonnegative().max(MAX_AMOUNT),
    ),
  })
  .superRefine((data, ctx) => {
    for (const category of Object.keys(data.categories)) {
      if (!(EXPENSE_CATEGORY_KEYS as readonly string[]).includes(category)) {
        ctx.addIssue({
          code: "custom",
          path: ["categories", category],
          message: "Unknown category",
        });
      }
    }
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
