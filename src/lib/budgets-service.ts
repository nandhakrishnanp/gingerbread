import { randomUUID } from "node:crypto";
import type { BudgetDoc } from "./collections";
import { budgets, ensureIndexes } from "./collections";
import type { BudgetRecord } from "./types";
import type { UpsertBudgetInput } from "./validation";

function toPayload(doc: BudgetDoc): BudgetRecord {
  return {
    month: doc.month,
    total: doc.total,
    categories: doc.categories,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

let indexesReady: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  indexesReady ??= ensureIndexes();
  return indexesReady;
}

export async function listBudgets(userId: string): Promise<BudgetRecord[]> {
  await ensureReady();
  const docs = await (await budgets())
    .find({ userId }, { projection: { userId: 0 } })
    .sort({ month: -1 })
    .toArray();
  return docs.map(toPayload);
}

/** Create or replace the budget for one month. */
export async function upsertBudget(
  userId: string,
  input: UpsertBudgetInput,
): Promise<BudgetRecord> {
  await ensureReady();
  const now = new Date();
  const collection = await budgets();
  const current = await collection.findOne({ userId, month: input.month });

  if (current) {
    const updated: BudgetDoc = {
      ...current,
      total: input.total,
      categories: input.categories,
      updatedAt: now,
    };
    await collection.replaceOne({ _id: current._id, userId }, updated);
    return toPayload(updated);
  }

  const doc: BudgetDoc = {
    _id: randomUUID(),
    userId,
    month: input.month,
    total: input.total,
    categories: input.categories,
    createdAt: now,
    updatedAt: now,
  };
  await collection.insertOne(doc);
  return toPayload(doc);
}
