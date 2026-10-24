/**
 * Pure money logic: category keys, period ranges, totals, charts buckets,
 * budgets and the plaintext backup format. Amounts are always integer paise so
 * rounding never drifts. Dates are local `YYYY-MM-DD` keys, like the journal.
 */
import { addDays, dateKey, parseDateKey, startOfDay } from "./streaks";
import type {
  BudgetRecord,
  ExpenseKind,
  ExpenseRecord,
  PaymentMethod,
} from "./types";

export const EXPENSE_CATEGORY_KEYS = [
  "food",
  "transport",
  "bills",
  "shopping",
  "health",
  "fun",
  "home",
  "education",
  "other",
] as const;

export const INCOME_CATEGORY_KEYS = [
  "salary",
  "freelance",
  "business",
  "gift",
  "other",
] as const;

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORY_KEYS)[number];
export type IncomeCategoryKey = (typeof INCOME_CATEGORY_KEYS)[number];

/** The preset categories offered for a given kind. */
export function categoriesFor(kind: ExpenseKind): readonly string[] {
  return kind === "income" ? INCOME_CATEGORY_KEYS : EXPENSE_CATEGORY_KEYS;
}

export const CURRENCY = "INR";

export const PERIODS = ["day", "week", "month", "year"] as const;
export type Period = (typeof PERIODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank",
  other: "Other",
};

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Inclusive local-day range covered by a period anchored on `anchor`. */
export function periodRange(period: Period, anchor: Date): DateRange {
  const day = startOfDay(anchor);

  if (period === "day") {
    const from = dateKey(day);
    return {
      from,
      to: from,
      label: day.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    };
  }

  if (period === "week") {
    const monday = addDays(day, day.getDay() === 0 ? -6 : 1 - day.getDay());
    const sunday = addDays(monday, 6);
    return {
      from: dateKey(monday),
      to: dateKey(sunday),
      label: `${shortDate(monday)} – ${shortDate(sunday)}`,
    };
  }

  if (period === "month") {
    const first = new Date(day.getFullYear(), day.getMonth(), 1);
    const last = new Date(day.getFullYear(), day.getMonth() + 1, 0);
    return {
      from: dateKey(first),
      to: dateKey(last),
      label: first.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    };
  }

  const year = day.getFullYear();
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    label: String(year),
  };
}

/** Step the anchor one period forward (or back) while keeping it local. */
export function shiftPeriod(
  anchor: Date,
  period: Period,
  delta: number,
): Date {
  const day = startOfDay(anchor);
  if (period === "day") return addDays(day, delta);
  if (period === "week") return addDays(day, delta * 7);
  if (period === "month") {
    return new Date(day.getFullYear(), day.getMonth() + delta, 1);
  }
  return new Date(day.getFullYear() + delta, 0, 1);
}

export function previousRange(period: Period, anchor: Date): DateRange {
  return periodRange(period, shiftPeriod(anchor, period, -1));
}

/** Records whose `date` falls inside the inclusive range. */
export function filterByRange<T extends { date: string }>(
  records: T[],
  from: string,
  to: string,
): T[] {
  return records.filter((record) => record.date >= from && record.date <= to);
}

export interface MoneyTotals {
  income: number;
  expense: number;
  net: number;
  count: number;
  largestExpense: number;
}

export function totalsFor(records: ExpenseRecord[]): MoneyTotals {
  let income = 0;
  let expense = 0;
  let largestExpense = 0;
  for (const record of records) {
    if (record.kind === "income") income += record.amount;
    else {
      expense += record.amount;
      if (record.amount > largestExpense) largestExpense = record.amount;
    }
  }
  return {
    income,
    expense,
    net: income - expense,
    count: records.length,
    largestExpense,
  };
}

export interface CategoryTotal {
  category: string;
  amount: number;
}

/** Category totals for one kind, biggest first. */
export function categoryTotals(
  records: ExpenseRecord[],
  kind: ExpenseKind,
): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const record of records) {
    if (record.kind !== kind) continue;
    totals.set(record.category, (totals.get(record.category) ?? 0) + record.amount);
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .filter((item) => item.amount > 0)
    .sort(
      (a, b) =>
        b.amount - a.amount || a.category.localeCompare(b.category),
    );
}

export interface MoneyBucket {
  key: string;
  label: string;
  income: number;
  expense: number;
}

function emptyBucket(key: string, label: string): MoneyBucket {
  return { key, label, income: 0, expense: 0 };
}

function bucketForDate(date: Date, label: string): MoneyBucket {
  return emptyBucket(dateKey(date), label);
}

/**
 * Chart buckets for a period:
 * - day: the seven days ending on the anchor (context around the day)
 * - week: Monday → Sunday
 * - month: every day of the month
 * - year: twelve months
 */
export function bucketSeries(
  records: ExpenseRecord[],
  period: Period,
  anchor: Date,
): MoneyBucket[] {
  const buckets: MoneyBucket[] = [];
  const day = startOfDay(anchor);

  if (period === "day" || period === "week") {
    const start =
      period === "day"
        ? addDays(day, -6)
        : addDays(day, day.getDay() === 0 ? -6 : 1 - day.getDay());
    for (let index = 0; index < 7; index += 1) {
      const date = addDays(start, index);
      buckets.push(
        bucketForDate(
          date,
          date.toLocaleDateString(undefined, { weekday: "short" }),
        ),
      );
    }
  } else if (period === "month") {
    const first = new Date(day.getFullYear(), day.getMonth(), 1);
    const days = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
    for (let index = 0; index < days; index += 1) {
      const date = addDays(first, index);
      buckets.push(bucketForDate(date, String(date.getDate())));
    }
  } else {
    const year = day.getFullYear();
    for (let month = 0; month < 12; month += 1) {
      const date = new Date(year, month, 1);
      buckets.push(
        emptyBucket(
          `${year}-${String(month + 1).padStart(2, "0")}`,
          date.toLocaleDateString(undefined, { month: "short" }),
        ),
      );
    }
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const record of records) {
    const key = period === "year" ? record.date.slice(0, 7) : record.date;
    const bucket = byKey.get(key);
    if (!bucket) continue;
    if (record.kind === "income") bucket.income += record.amount;
    else bucket.expense += record.amount;
  }
  return buckets;
}

/** Whole days covered by an inclusive range. */
export function daysInRange(from: string, to: string): number {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((endUtc - startUtc) / 86_400_000) + 1);
}

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const inrExact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format integer paise as ₹1,847 or ₹1,847.50. */
export function formatMoney(paise: number): string {
  const safe = Number.isFinite(paise) ? paise : 0;
  return safe % 100 === 0 ? inrWhole.format(safe / 100) : inrExact.format(safe / 100);
}

/** A plain decimal string suitable for an amount input. */
export function formatAmountInput(paise: number): string {
  return paise % 100 === 0
    ? String(paise / 100)
    : (paise / 100).toFixed(2);
}

/** Parse user input such as "42.50" into integer paise. */
export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise) || paise <= 0) return null;
  return paise;
}

export interface BudgetProgress {
  /** Capped 0–1 for progress bars. */
  percent: number;
  /** Uncapped percentage, useful for "over budget" copy. */
  rawPercent: number;
  remaining: number;
  over: number;
}

export function budgetProgress(spent: number, budget: number): BudgetProgress {
  const rawPercent = budget > 0 ? (spent / budget) * 100 : 0;
  return {
    percent: Math.min(1, Math.max(0, rawPercent / 100)),
    rawPercent,
    remaining: Math.max(0, budget - spent),
    over: Math.max(0, spent - budget),
  };
}

/** `YYYY-MM` for a local date. */
export function monthKeyFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Days still to come in the budget month (0 for past months). */
export function daysLeftInMonth(
  monthKey: string,
  today: Date = new Date(),
): number {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return 0;
  const current = monthKeyFor(today);
  if (monthKey < current) return 0;
  if (monthKey > current) {
    return new Date(year, month, 0).getDate();
  }
  return Math.max(0, new Date(year, month, 0).getDate() - today.getDate());
}

/** `YYYY-MM` range for a budget month. */
export function monthRange(monthKey: string): { from: string; to: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return { from: dateKey(first), to: dateKey(last) };
}

// ---------------------------------------------------------------------------
// Plaintext money backup
// ---------------------------------------------------------------------------

export interface MoneyBackup {
  expenses: ExpenseRecord[];
  budgets: BudgetRecord[];
}

export function moneyToBackup(
  expenses: ExpenseRecord[],
  budgets: BudgetRecord[],
): string {
  return JSON.stringify(
    {
      app: "gingerbread",
      kind: "money-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      count: expenses.length + budgets.length,
      expenses,
      budgets,
    },
    null,
    2,
  );
}

export function parseMoneyBackup(text: string): MoneyBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not a valid JSON backup file");
  }
  const doc = parsed as {
    kind?: string;
    expenses?: unknown;
    budgets?: unknown;
  };
  if (doc.kind !== "money-backup" || !Array.isArray(doc.expenses)) {
    throw new Error("Not a Gingerbread money backup");
  }
  return {
    expenses: doc.expenses as ExpenseRecord[],
    budgets: Array.isArray(doc.budgets) ? (doc.budgets as BudgetRecord[]) : [],
  };
}

/** Browser-only download of the plaintext money backup. */
export function exportMoneyBackup(
  expenses: ExpenseRecord[],
  budgets: BudgetRecord[],
): void {
  if (typeof document === "undefined") return;
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([moneyToBackup(expenses, budgets)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gingerbread-money-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
