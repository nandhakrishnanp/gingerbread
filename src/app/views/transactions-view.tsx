"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { fetchExpensePage } from "@/lib/api-client";
import { formatMoney } from "@/lib/expenses";
import { addDays, dateKey } from "@/lib/streaks";
import { formatShortDate, plural } from "@/lib/format";
import type { ExpenseKind, ExpenseRecord } from "@/lib/types";
import { PAYMENT_META, categoryMeta } from "../expense-meta";
import { cn } from "../cn";

const PAGE_SIZE = 20;

function groupByDate(
  records: ExpenseRecord[],
): Array<[string, ExpenseRecord[]]> {
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

export function TransactionsView({
  from,
  to,
  periodLabel,
  refreshToken,
  onBack,
  onCreate,
  onEdit,
  onDelete,
}: {
  from: string;
  to: string;
  periodLabel: string;
  refreshToken: number;
  onBack: () => void;
  onCreate: () => void;
  onEdit: (record: ExpenseRecord) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<"all" | ExpenseKind>("all");
  const [items, setItems] = useState<ExpenseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestRef = useRef(0);
  const loadMoreRef = useRef(false);

  useEffect(() => {
    const requestId = ++requestRef.current;
    let active = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError("");
    setItems([]);
    setNextCursor(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchExpensePage({
      from,
      to,
      kind: kind === "all" ? undefined : kind,
      limit: PAGE_SIZE,
    })
      .then((page) => {
        if (!active || requestId !== requestRef.current) return;
        setItems(page.expenses);
        setNextCursor(page.nextCursor);
        setTotal(page.total);
      })
      .catch((err) => {
        if (!active || requestId !== requestRef.current) return;
        setError(
          err instanceof Error ? err.message : "Could not load transactions.",
        );
      })
      .finally(() => {
        if (active && requestId === requestRef.current) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [from, to, kind, refreshToken, reloadKey]);

  const groups = useMemo(() => groupByDate(items), [items]);

  async function loadMore() {
    if (!nextCursor || loadMoreRef.current) return;
    loadMoreRef.current = true;
    const requestId = requestRef.current;
    setLoadingMore(true);
    setError("");
    try {
      const page = await fetchExpensePage({
        from,
        to,
        kind: kind === "all" ? undefined : kind,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      if (requestId !== requestRef.current) return;
      setItems((current) => [...current, ...page.expenses]);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(
        err instanceof Error ? err.message : "Could not load more transactions.",
      );
    } finally {
      loadMoreRef.current = false;
      setLoadingMore(false);
    }
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
      setItems((current) => current.filter((item) => item.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this entry.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="animate-view space-y-4">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Money"
          className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full border border-smoke bg-paper text-ink hover:bg-mist"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-ash">
            Money · {periodLabel}
          </p>
          <h1 className="mt-0.5 truncate text-xl font-semibold tracking-[-0.03em]">
            All transactions
          </h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          aria-label="Add expense"
          className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden />
        </button>
      </header>

      <div className="grid grid-cols-3 gap-1 rounded-full border border-smoke bg-mist p-1">
        {(["all", "expense", "income"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            aria-pressed={kind === option}
            className={cn(
              "tap rounded-full px-2 py-1.5 text-[0.68rem] font-semibold capitalize",
              kind === option
                ? "bg-ink text-paper"
                : "text-ash hover:text-ink",
            )}
          >
            {option === "all" ? "All" : `${option}s`}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="tap shrink-0 rounded-full border border-red-500/30 px-2.5 py-1 text-[0.65rem] font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-ash">
          {loading
            ? "Loading…"
            : `${total} ${plural(total, "transaction")}`}
        </p>
        {!loading && total > 0 && items.length < total && (
          <p className="text-[0.62rem] text-ash">
            Showing {items.length} of {total}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((key) => (
            <div
              key={key}
              className="h-16 animate-pulse rounded-2xl border border-smoke bg-paper dark:bg-mist"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-smoke px-4 py-12 text-center">
          <p className="text-sm font-semibold">No transactions here.</p>
          <p className="mt-1 text-xs text-ash">
            Add an expense or income entry to get started.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="tap mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add expense
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, records]) => (
            <div key={date}>
              <p className="px-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ash">
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
                      className="flex items-center gap-2.5 rounded-2xl border border-smoke bg-paper px-2.5 py-2.5 dark:bg-mist"
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
                          <payment.Icon className="h-2.5 w-2.5" aria-hidden />
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
                          onClick={() => onEdit(record)}
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

      {!loading && nextCursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="tap w-full rounded-full border border-smoke bg-paper py-3 text-sm font-semibold text-ink hover:bg-mist disabled:opacity-40 dark:bg-mist"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}

      {!loading && !nextCursor && items.length > 0 && (
        <p className="pb-2 text-center text-[0.64rem] text-ash">
          You’re all caught up.
        </p>
      )}
    </div>
  );
}
