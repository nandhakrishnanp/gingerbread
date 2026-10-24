import type { Filter } from "mongodb";
import type { ExpenseDoc } from "./collections";
import { ensureIndexes, expenses } from "./collections";
import type { ExpenseKind, ExpenseRecord } from "./types";
import type { CreateExpenseInput, UpdateExpenseInput } from "./validation";

function toPayload(doc: ExpenseDoc): ExpenseRecord {
  return {
    id: doc._id,
    date: doc.date,
    kind: doc.kind,
    amount: doc.amount,
    category: doc.category,
    payment: doc.payment,
    note: doc.note,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

let indexesReady: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  indexesReady ??= ensureIndexes();
  return indexesReady;
}

export async function listExpenses(
  userId: string,
  range?: { from?: string; to?: string },
): Promise<ExpenseRecord[]> {
  await ensureReady();
  const dateFilter: Record<string, string> = {};
  if (range?.from) dateFilter.$gte = range.from;
  if (range?.to) dateFilter.$lte = range.to;

  const filter: Record<string, unknown> = { userId };
  if (Object.keys(dateFilter).length > 0) filter.date = dateFilter;

  const docs = await (await expenses())
    .find(filter, { projection: { userId: 0 } })
    .sort({ date: -1, createdAt: -1 })
    .toArray();
  return docs.map(toPayload);
}

interface ExpenseCursor {
  date: string;
  createdAt: Date;
  id: string;
}

function encodeCursor(doc: ExpenseDoc): string {
  return Buffer.from(
    JSON.stringify({
      d: doc.date,
      c: doc.createdAt.toISOString(),
      i: doc._id,
    }),
  ).toString("base64url");
}

function decodeCursor(value: string): ExpenseCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as { d?: unknown; c?: unknown; i?: unknown };
    if (
      typeof parsed.d !== "string" ||
      typeof parsed.c !== "string" ||
      typeof parsed.i !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parsed.d)
    ) {
      return null;
    }
    const createdAt = new Date(parsed.c);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { date: parsed.d, createdAt, id: parsed.i };
  } catch {
    return null;
  }
}

export interface ExpensePageQuery {
  from?: string;
  to?: string;
  kind?: ExpenseKind;
  limit: number;
  cursor?: string;
}

export type ExpensePageResult =
  | {
      ok: true;
      expenses: ExpenseRecord[];
      nextCursor: string | null;
      total: number;
    }
  | { ok: false; reason: "invalid-cursor" };

/**
 * One page of expenses, newest first. Uses a compound cursor so entries with
 * the same date stay stable while paging. `total` is the full count for the
 * filter, not just the page.
 */
export async function listExpensesPage(
  userId: string,
  query: ExpensePageQuery,
): Promise<ExpensePageResult> {
  await ensureReady();
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (query.cursor && !cursor) {
    return { ok: false, reason: "invalid-cursor" };
  }

  const base: Filter<ExpenseDoc> = { userId };
  if (query.kind) base.kind = query.kind;
  const dates: Record<string, string> = {};
  if (query.from) dates.$gte = query.from;
  if (query.to) dates.$lte = query.to;
  if (Object.keys(dates).length > 0) base.date = dates;

  const collection = await expenses();
  const total = await collection.countDocuments(base);

  const filter: Filter<ExpenseDoc> = { ...base };
  if (cursor) {
    filter.$and = [
      {
        $or: [
          { date: { $lt: cursor.date } },
          { date: cursor.date, createdAt: { $lt: cursor.createdAt } },
          {
            date: cursor.date,
            createdAt: cursor.createdAt,
            _id: { $lt: cursor.id },
          },
        ],
      },
    ];
  }

  const docs = await collection
    .find(filter, { projection: { userId: 0 } })
    .sort({ date: -1, createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray();

  const hasMore = docs.length > query.limit;
  const page = hasMore ? docs.slice(0, query.limit) : docs;
  return {
    ok: true,
    expenses: page.map(toPayload),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    total,
  };
}

export async function createExpense(
  userId: string,
  input: CreateExpenseInput,
): Promise<ExpenseRecord> {
  await ensureReady();
  const now = new Date();
  const doc: ExpenseDoc = {
    _id: input.id,
    userId,
    date: input.date,
    kind: input.kind,
    amount: input.amount,
    category: input.category,
    payment: input.payment,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };
  await (await expenses()).insertOne(doc);
  return toPayload(doc);
}

export type ExpenseUpdateResult =
  | { ok: true; expense: ExpenseRecord }
  | { ok: false; reason: "not-found" };

export async function updateExpense(
  userId: string,
  id: string,
  input: UpdateExpenseInput,
): Promise<ExpenseUpdateResult> {
  await ensureReady();
  const collection = await expenses();
  const current = await collection.findOne({ _id: id, userId });
  if (!current) return { ok: false, reason: "not-found" };

  const updated: ExpenseDoc = {
    ...current,
    date: input.date,
    kind: input.kind,
    amount: input.amount,
    category: input.category,
    payment: input.payment,
    note: input.note,
    updatedAt: new Date(),
  };
  await collection.replaceOne({ _id: id, userId }, updated);
  return { ok: true, expense: toPayload(updated) };
}

export async function deleteExpense(
  userId: string,
  id: string,
): Promise<boolean> {
  await ensureReady();
  const result = await (await expenses()).deleteOne({ _id: id, userId });
  return result.deletedCount === 1;
}
