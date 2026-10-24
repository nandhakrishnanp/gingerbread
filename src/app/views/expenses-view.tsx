"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  PERIODS,
  bucketSeries,
  budgetProgress,
  categoryTotals,
  daysInRange,
  daysLeftInMonth,
  filterByRange,
  formatMoney,
  monthKeyFor,
  monthRange,
  periodRange,
  previousRange,
  shiftPeriod,
  totalsFor,
  type Period,
} from "@/lib/expenses";
import { addDays, dateKey } from "@/lib/streaks";
import { formatShortDate, plural } from "@/lib/format";
import type {
  BudgetRecord,
  ExpenseInput,
  ExpenseRecord,
  PaymentMethod,
} from "@/lib/types";
import { PAYMENT_META, categoryMeta } from "../expense-meta";
import { BudgetSheet } from "./budget-form";
import { ExpenseSheet } from "./expense-form";
import {
  CategoryBreakdown,
  CategoryDonut,
  SpendingTrend,
} from "./expense-charts";
import { TransactionsView } from "./transactions-view";
import { cn } from "../cn";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
};

interface Props {
  expenses: ExpenseRecord[];
  budgets: BudgetRecord[];
  onCreate: (input: ExpenseInput) => Promise<void>;
  onUpdate: (id: string, input: ExpenseInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveBudget: (input: {
    month: string;
    total: number;
    categories: Record<string, number>;
  }) => Promise<void>;
}

function groupByDate(records: ExpenseRecord[]): Array<[string, ExpenseRecord[]]> {
  const groups = new Map<string, ExpenseRecord[]>();
  for (const record of records) {
    const list = groups.get(record.date) ?? [];
    list.push(record);
    groups.set(record.date, list);
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function dayLabel(key: string): string {
  const today = dateKey(new Date());
  if (key === today) return "Today";
  if (key === dateKey(addDays(new Date(), -1))) return "Yesterday";
  return formatShortDate(key);
}

export function ExpensesView({
  expenses,
  budgets,
  onCreate,
  onUpdate,
  onDelete,
  onSaveBudget,
}: Props) {
  const [tab, setTab] = useState<"overview" | "insights">("overview");
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [listRefresh, setListRefresh] = useState(0);

  const range = periodRange(period, anchor);
  const currentRange = periodRange(period, new Date());
  const isCurrent = range.from === currentRange.from;

  const inRange = useMemo(
    () => filterByRange(expenses, range.from, range.to),
    [expenses, range.from, range.to],
  );
  const previous = useMemo(() => {
    const previousDates = previousRange(period, anchor);
    return filterByRange(expenses, previousDates.from, previousDates.to);
  }, [expenses, period, anchor]);
  const totals = useMemo(() => totalsFor(inRange), [inRange]);
  const previousTotals = useMemo(() => totalsFor(previous), [previous]);
  const buckets = useMemo(
    () => bucketSeries(expenses, period, anchor),
    [expenses, period, anchor],
  );
  const dayCount = daysInRange(range.from, range.to);
  const dailyAverage = Math.round(totals.expense / dayCount);

  const monthKey = monthKeyFor(anchor);
  const monthExpenseRecords = useMemo(() => {
    const dates = monthRange(monthKey);
    return filterByRange(expenses, dates.from, dates.to);
  }, [expenses, monthKey]);
  const monthTotals = useMemo(
    () => totalsFor(monthExpenseRecords),
    [monthExpenseRecords],
  );
  const expenseCategories = useMemo(
    () => categoryTotals(inRange, "expense"),
    [inRange],
  );
  const incomeCategories = useMemo(
    () => categoryTotals(inRange, "income"),
    [inRange],
  );
  const monthCategories = useMemo(
    () => categoryTotals(monthExpenseRecords, "expense"),
    [monthExpenseRecords],
  );
  const paymentTotals = useMemo(() => {
    const totals = new Map<PaymentMethod, number>();
    for (const record of inRange) {
      if (record.kind !== "expense") continue;
      totals.set(record.payment, (totals.get(record.payment) ?? 0) + record.amount);
    }
    return [...totals.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [inRange]);
  const topExpenses = useMemo(
    () =>
      inRange
        .filter((record) => record.kind === "expense")
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [inRange],
  );
  const budget = budgets.find((item) => item.month === monthKey) ?? null;
  const progress = budget ? budgetProgress(monthTotals.expense, budget.total) : null;
  const daysLeft = daysLeftInMonth(monthKey);

  const previewGroups = useMemo(
    () => groupByDate(inRange.slice(0, 5)),
    [inRange],
  );
  const donutSlices = expenseCategories.map((item) => {
    const meta = categoryMeta(item.category, "expense");
    return {
      key: item.category,
      label: meta.label,
      value: item.amount,
      color: meta.hex,
    };
  });

  const delta = (() => {
    if (previousTotals.expense === 0) {
      return totals.expense > 0
        ? { text: "New spending this period", up: true }
        : null;
    }
    const percent = Math.round(
      ((totals.expense - previousTotals.expense) / previousTotals.expense) * 100,
    );
    if (percent === 0) return { text: "Same as the previous period", up: null };
    return {
      text: `${percent > 0 ? "+" : ""}${percent}% vs previous period`,
      up: percent > 0,
    };
  })();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(record: ExpenseRecord) {
    setEditing(record);
    setSheetOpen(true);
  }

  async function remove(id: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setBusyId(id);
    setError("");
    try {
      await onDelete(id);
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this entry.");
    } finally {
      setBusyId(null);
    }
  }

  const expenseSheet = sheetOpen ? (
    <ExpenseSheet
      key={editing?.id ?? "new"}
      editing={editing}
      defaultDate={dateKey(anchor)}
      busy={busyId !== null}
      onClose={() => {
        setSheetOpen(false);
        setEditing(null);
      }}
      onSave={async (input) => {
        if (editing) await onUpdate(editing.id, input);
        else await onCreate(input);
        setListRefresh((value) => value + 1);
      }}
    />
  ) : null;

  const budgetSheet = budgetOpen ? (
    <BudgetSheet
      month={monthKey}
      budget={budget}
      busy={busyId !== null}
      onClose={() => setBudgetOpen(false)}
      onSave={onSaveBudget}
    />
  ) : null;

  if (showAllTransactions) {
    return (
      <>
        <TransactionsView
          from={range.from}
          to={range.to}
          periodLabel={range.label}
          refreshToken={listRefresh}
          onBack={() => setShowAllTransactions(false)}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={onDelete}
        />
        {expenseSheet}
      </>
    );
  }

  return (
    <div className="animate-view space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ash">
            Cash flow, honestly
          </p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-[1.05] tracking-[-0.045em]">
            Money
          </h1>
          <p className="mt-1 text-sm text-ash">
            What came in, what went out, and where it went.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          aria-label="Add expense"
          className="tap grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-lg"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden />
        </button>
      </header>

      {error && (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-full border border-smoke bg-mist p-1">
        {(["overview", "insights"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTab(option)}
            aria-pressed={tab === option}
            className={cn(
              "tap rounded-full px-3 py-2 text-xs font-semibold capitalize",
              tab === option ? "bg-ink text-paper" : "text-ash hover:text-ink",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1 rounded-full border border-smoke bg-paper p-1">
          {PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              aria-pressed={period === option}
              className={cn(
                "tap rounded-full px-1 py-1.5 text-[0.7rem] font-semibold",
                period === option
                  ? "bg-accent-lime text-[#09090b]"
                  : "text-ash hover:text-ink",
              )}
            >
              {PERIOD_LABELS[option]}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => setAnchor((current) => shiftPeriod(current, period, -1))}
            aria-label="Previous period"
            className="tap grid h-8 w-8 place-items-center rounded-full border border-smoke bg-paper text-ink hover:bg-mist"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold">{range.label}</p>
            {!isCurrent && (
              <button
                type="button"
                onClick={() => setAnchor(new Date())}
                className="tap rounded-full border border-smoke px-2 py-0.5 text-[0.6rem] font-semibold text-ash hover:text-ink"
              >
                Today
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAnchor((current) => shiftPeriod(current, period, 1))}
            disabled={isCurrent}
            aria-label="Next period"
            className="tap grid h-8 w-8 place-items-center rounded-full border border-smoke bg-paper text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-5 text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)] dark:border-smoke dark:bg-[#111114]">
        <span
          aria-hidden
          className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-accent-lime/20 blur-2xl"
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/55">
                Spent
              </p>
              <p className="mt-1 text-[2.6rem] font-extrabold leading-none tracking-[-0.05em] tabular-nums">
                {formatMoney(totals.expense)}
              </p>
              <p className="mt-1.5 text-xs text-white/55">{range.label}</p>
              <p className="mt-2 text-[0.68rem] font-medium text-white/60">
                <span className="text-accent-lime">
                  +{formatMoney(totals.income)} in
                </span>
                <span className="mx-1.5" aria-hidden>
                  ·
                </span>
                <span>
                  Net {totals.net >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(totals.net))}
                </span>
              </p>
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-accent-lime">
              <Wallet className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
          </div>

          {delta && (
            <p
              className={cn(
                "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.64rem] font-semibold",
                delta.up === null
                  ? "bg-white/10 text-white/70"
                  : delta.up
                    ? "bg-accent-orange/15 text-accent-orange"
                    : "bg-accent-lime/15 text-accent-lime",
              )}
            >
              {delta.up === null ? null : delta.up ? (
                <TrendingUp className="h-3 w-3" aria-hidden />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden />
              )}
              {delta.text}
            </p>
          )}

          {budget && budget.total > 0 && progress && (
            <div className="mt-4 rounded-2xl bg-white/10 p-3">
              <div className="flex items-center justify-between gap-2 text-[0.64rem] font-semibold text-white/65">
                <span>
                  {formatMoney(monthTotals.expense)} of {formatMoney(budget.total)}{" "}
                  budget
                </span>
                <span className="tabular-nums">
                  {progress.over > 0
                    ? `${formatMoney(progress.over)} over`
                    : `${daysLeft} ${plural(daysLeft, "day")} left`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700",
                    progress.over > 0 ? "bg-accent-orange" : "bg-accent-lime",
                  )}
                  style={{ width: `${Math.max(2, progress.percent * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
            <Stat label="Daily average" value={formatMoney(dailyAverage)} />
            <Stat
              label="Transactions"
              value={String(totals.count)}
              suffix={plural(totals.count, "entry", "entries")}
            />
            <Stat
              label="Largest"
              value={formatMoney(totals.largestExpense)}
            />
          </div>
        </div>
      </section>

      {tab === "overview" ? (
        <>
          <section className="rounded-[1.75rem] border border-smoke bg-paper p-4 shadow-sm dark:bg-mist dark:shadow-none sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Spending trend
                </h2>
                <p className="mt-0.5 text-xs text-ash">{range.label}</p>
              </div>
              <span className="text-xs font-semibold text-ash">
                {period === "day"
                  ? "Last 7 days"
                  : totals.expense > 0
                    ? `${formatMoney(dailyAverage)}/day`
                    : "No spending"}
              </span>
            </div>
            <SpendingTrend buckets={buckets} />
          </section>

          <section className="rounded-[1.75rem] border border-smoke bg-paper p-4 shadow-sm dark:bg-mist dark:shadow-none sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">
                Top categories
              </h2>
              {expenseCategories.length > 3 && (
                <button
                  type="button"
                  onClick={() => setTab("insights")}
                  className="tap text-xs font-semibold text-ash hover:text-ink"
                >
                  View all
                </button>
              )}
            </div>
            <CategoryBreakdown
              items={expenseCategories.slice(0, 3)}
              total={totals.expense}
              kind="expense"
              budgets={period === "month" ? budget?.categories : undefined}
            />
          </section>

          <section className="rounded-[1.75rem] border border-smoke bg-paper p-4 shadow-sm dark:bg-mist dark:shadow-none sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Transactions
                </h2>
                <p className="mt-0.5 text-[0.65rem] text-ash">
                  {totals.count} {plural(totals.count, "entry", "entries")} in{" "}
                  {range.label.toLowerCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllTransactions(true)}
                className="tap shrink-0 rounded-full border border-smoke px-3 py-1.5 text-[0.68rem] font-semibold hover:bg-mist"
              >
                View all
              </button>
            </div>

            {previewGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-smoke px-4 py-8 text-center">
                <p className="text-sm font-semibold">Nothing here yet.</p>
                <p className="mt-1 text-xs text-ash">
                  Add an expense and it will show up here.
                </p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="tap mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add expense
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {previewGroups.map(([date, records]) => (
                  <div key={date}>
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ash">
                      {dayLabel(date)}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {records.map((record) => {
                        const meta = categoryMeta(record.category, record.kind);
                        const payment = PAYMENT_META[record.payment];
                        const isIncome = record.kind === "income";
                        return (
                          <li
                            key={record.id}
                            className="flex items-center gap-2.5 rounded-2xl border border-smoke/70 px-2.5 py-2"
                          >
                            <span
                              className={cn(
                                "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#09090b]",
                                meta.bg,
                              )}
                            >
                              <meta.Icon
                                className="h-4 w-4"
                                strokeWidth={2.1}
                                aria-hidden
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {record.note || meta.label}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1 text-[0.62rem] text-ash">
                                <span>{meta.label}</span>
                                <span aria-hidden>·</span>
                                <payment.Icon
                                  className="h-2.5 w-2.5"
                                  aria-hidden
                                />
                                <span>{payment.label}</span>
                              </p>
                            </div>
                            <p
                              className={cn(
                                "shrink-0 text-sm font-bold tabular-nums",
                                isIncome
                                  ? "text-[#4d7c0f] dark:text-accent-green"
                                  : "text-ink",
                              )}
                            >
                              {isIncome ? "+" : ""}
                              {formatMoney(record.amount)}
                            </p>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => openEdit(record)}
                                aria-label={`Edit ${record.note || meta.label}`}
                                className="tap grid h-7 w-7 place-items-center rounded-full text-ash hover:bg-mist hover:text-ink"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => void remove(record.id)}
                                disabled={busyId === record.id}
                                aria-label={
                                  confirmId === record.id
                                    ? `Confirm delete ${record.note || meta.label}`
                                    : `Delete ${record.note || meta.label}`
                                }
                                className={cn(
                                  "tap grid h-7 w-7 place-items-center rounded-full",
                                  confirmId === record.id
                                    ? "bg-red-600 text-white"
                                    : "text-ash hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300",
                                )}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {previewGroups.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllTransactions(true)}
                className="tap mt-3 w-full rounded-full border border-smoke py-2 text-xs font-semibold text-ash hover:bg-mist hover:text-ink"
              >
                View all transactions
              </button>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-[1.75rem] border border-smoke bg-paper p-4 shadow-sm dark:bg-mist dark:shadow-none sm:p-5">
            <h2 className="text-base font-semibold tracking-tight">
              Category breakdown
            </h2>
            <p className="mt-0.5 text-xs text-ash">
              Where the money went in {range.label.toLowerCase()}.
            </p>
            <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <CategoryDonut slices={donutSlices} total={totals.expense} />
              <div className="w-full min-w-0 flex-1">
                <CategoryBreakdown
                  items={expenseCategories}
                  total={totals.expense}
                  kind="expense"
                  budgets={period === "month" ? budget?.categories : undefined}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-smoke bg-paper p-4 shadow-sm dark:bg-mist dark:shadow-none sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Payment mix
                </h2>
                <p className="mt-0.5 text-xs text-ash">
                  How you paid for expenses in {range.label.toLowerCase()}.
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-ash">
                {formatMoney(totals.expense)}
              </span>
            </div>

            {paymentTotals.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-smoke px-4 py-6 text-center text-xs text-ash">
                No expenses in this period yet.
              </p>
            ) : (
              <ul className="space-y-3.5">
                {paymentTotals.map((item) => {
                  const meta = PAYMENT_META[item.method];
                  const share =
                    totals.expense > 0
                      ? (item.amount / totals.expense) * 100
                      : 0;
                  return (
                    <li key={item.method}>
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-smoke/60 text-ink dark:bg-smoke">
                          <meta.Icon
                            className="h-4 w-4"
                            strokeWidth={2.1}
                            aria-hidden
                          />
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium">
                          {meta.label}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums">
                          {formatMoney(item.amount)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-smoke/60 dark:bg-smoke">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.max(2, share)}%`,
                            backgroundColor: meta.hex,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[0.6rem] font-medium text-ash">
                        {Math.round(share)}% of spending
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-smoke bg-paper p-4 shadow-sm dark:bg-mist dark:shadow-none sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Biggest expenses
                </h2>
                <p className="mt-0.5 text-xs text-ash">
                  The five largest single spends in this period.
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-ash">
                {formatMoney(totals.largestExpense)}
              </span>
            </div>

            {topExpenses.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-smoke px-4 py-6 text-center text-xs text-ash">
                No expenses in this period yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {topExpenses.map((record) => {
                  const meta = categoryMeta(record.category, "expense");
                  return (
                    <li key={record.id} className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#09090b]",
                          meta.bg,
                        )}
                      >
                        <meta.Icon
                          className="h-4 w-4"
                          strokeWidth={2.1}
                          aria-hidden
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {record.note || meta.label}
                        </p>
                        <p className="text-[0.6rem] text-ash">
                          {formatShortDate(record.date)} · {meta.label}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums">
                        {formatMoney(record.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-smoke bg-paper p-4 shadow-sm dark:bg-mist dark:shadow-none sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Budget goals
                </h2>
                <p className="mt-0.5 text-xs text-ash">
                  For {new Date(anchor.getFullYear(), anchor.getMonth(), 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBudgetOpen(true)}
                className="tap rounded-full border border-smoke px-3 py-1.5 text-[0.68rem] font-semibold"
              >
                {budget ? "Edit" : "Set budget"}
              </button>
            </div>

            {budget ? (
              <div className="mt-4 space-y-4">
                {budget.total > 0 && progress && (
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{formatMoney(monthTotals.expense)} spent</span>
                      <span className="text-ash">
                        of {formatMoney(budget.total)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-smoke/60 dark:bg-smoke">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-700",
                          progress.over > 0 ? "bg-red-500" : "bg-accent-green",
                        )}
                        style={{ width: `${Math.max(2, progress.percent * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[0.64rem] text-ash">
                      {progress.over > 0
                        ? `${formatMoney(progress.over)} over budget`
                        : `${formatMoney(progress.remaining)} left · ${daysLeft} ${
                            plural(daysLeft, "day")
                          } to go`}
                    </p>
                  </div>
                )}

                {Object.keys(budget.categories).length > 0 ? (
                  <CategoryBreakdown
                    items={Object.keys(budget.categories)
                      .map((category) => ({
                        category,
                        amount:
                          monthCategories.find(
                            (item) => item.category === category,
                          )?.amount ?? 0,
                      }))
                      .sort((a, b) => b.amount - a.amount)}
                    total={monthTotals.expense}
                    kind="expense"
                    budgets={budget.categories}
                  />
                ) : (
                  <p className="text-xs text-ash">
                    Add per-category limits to see how each one is tracking.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-smoke px-4 py-6 text-center">
                <p className="text-sm font-semibold">No budget for this month.</p>
                <p className="mt-1 text-xs text-ash">
                  A ceiling makes the graph more useful.
                </p>
              </div>
            )}
          </section>

          {incomeCategories.length > 0 && (
            <section className="rounded-[1.75rem] border border-smoke bg-paper p-4 shadow-sm dark:bg-mist dark:shadow-none sm:p-5">
              <h2 className="text-base font-semibold tracking-tight">
                Income sources
              </h2>
              <div className="mt-3">
                <CategoryBreakdown
                  items={incomeCategories}
                  total={totals.income}
                  kind="income"
                />
              </div>
            </section>
          )}

          <p className="px-1 pb-2 text-center text-[0.66rem] leading-relaxed text-ash">
            Expenses and budgets are stored unencrypted so they can be read and
            totalled on the server. Journal entries, habits and thoughts stay
            end-to-end encrypted.
          </p>
        </>
      )}

      {expenseSheet}
      {budgetSheet}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[0.55rem] font-bold uppercase tracking-[0.14em] text-white/50">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-extrabold tabular-nums">
        {value}
      </p>
      {suffix && (
        <p className="text-[0.55rem] font-medium text-white/45">{suffix}</p>
      )}
    </div>
  );
}
