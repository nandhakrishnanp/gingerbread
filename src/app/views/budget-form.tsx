"use client";

import { useState } from "react";
import {
  EXPENSE_CATEGORY_KEYS,
  formatAmountInput,
  parseAmount,
} from "@/lib/expenses";
import type { BudgetRecord } from "@/lib/types";
import { categoryMeta } from "../expense-meta";
import { Sheet } from "../sheet";
import { labelClass } from "../ui";

/** Budgets accept empty or 0; anything else must parse like an expense. */
function parseBudgetField(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const cleaned = trimmed.replace(/[₹,\s]/g, "");
  if (!Number.isFinite(Number(cleaned)) || Number(cleaned) < 0) return null;
  if (Number(cleaned) === 0) return 0;
  return parseAmount(trimmed);
}

export function BudgetSheet({
  month,
  budget,
  busy,
  onClose,
  onSave,
}: {
  month: string;
  budget: BudgetRecord | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    month: string;
    total: number;
    categories: Record<string, number>;
  }) => Promise<void>;
}) {
  const [total, setTotal] = useState(
    budget && budget.total > 0 ? formatAmountInput(budget.total) : "",
  );
  const [categories, setCategories] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of EXPENSE_CATEGORY_KEYS) {
      const value = budget?.categories?.[key] ?? 0;
      initial[key] = value > 0 ? formatAmountInput(value) : "";
    }
    return initial;
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [year, monthNumber] = month.split("-").map(Number);
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  async function save() {
    const totalPaise = parseBudgetField(total);
    if (totalPaise === null) {
      setError("Enter a valid total budget.");
      return;
    }

    const nextCategories: Record<string, number> = {};
    for (const key of EXPENSE_CATEGORY_KEYS) {
      const paise = parseBudgetField(categories[key] ?? "");
      if (paise === null) {
        setError(`Enter a valid budget for ${categoryMeta(key, "expense").label}.`);
        return;
      }
      if (paise > 0) nextCategories[key] = paise;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({ month, total: totalPaise, categories: nextCategories });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the budget.");
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || saving;

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Budget for ${label}`}
      description="A gentle ceiling, not a rule. Leave fields empty to ignore them."
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="tap ml-auto rounded-full border border-smoke px-4 py-2.5 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={disabled}
            className="tap rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save budget"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="budget-total">
            Monthly total
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-smoke bg-mist px-4">
            <span className="text-lg font-bold text-ash">₹</span>
            <input
              id="budget-total"
              inputMode="decimal"
              placeholder="0"
              value={total}
              onChange={(event) => setTotal(event.target.value)}
              className="w-full bg-transparent py-3 text-lg font-bold outline-none placeholder:text-ash/50"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className={labelClass}>Per category</p>
          {EXPENSE_CATEGORY_KEYS.map((key) => {
            const meta = categoryMeta(key, "expense");
            return (
              <label
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-smoke bg-paper px-3 py-2"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-mist text-ink">
                  <meta.Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {meta.label}
                </span>
                <span className="text-sm text-ash">₹</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={categories[key] ?? ""}
                  onChange={(event) =>
                    setCategories((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  aria-label={`${meta.label} budget`}
                  className="w-20 bg-transparent text-right text-sm font-semibold outline-none placeholder:text-ash/50"
                />
              </label>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
