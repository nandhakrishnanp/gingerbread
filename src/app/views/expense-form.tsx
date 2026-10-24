"use client";

import { useState } from "react";
import {
  categoriesFor,
  formatAmountInput,
  parseAmount,
} from "@/lib/expenses";
import {
  PAYMENT_METHODS,
  type ExpenseInput,
  type ExpenseKind,
  type ExpenseRecord,
  type PaymentMethod,
} from "@/lib/types";
import { PAYMENT_META, categoryMeta } from "../expense-meta";
import { Sheet } from "../sheet";
import { inputClass, labelClass } from "../ui";
import { cn } from "../cn";

function CategoryPicker({
  kind,
  value,
  onChange,
}: {
  kind: ExpenseKind;
  value: string;
  onChange: (category: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {categoriesFor(kind).map((key) => {
        const meta = categoryMeta(key, kind);
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className={cn(
              "tap flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-[0.66rem] font-semibold",
              active
                ? "border-ink bg-accent-lime text-[#09090b]"
                : "border-smoke bg-paper text-ink hover:bg-mist",
            )}
          >
            <meta.Icon className="h-4 w-4" strokeWidth={2.1} aria-hidden />
            <span className="truncate">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function KindToggle({
  kind,
  onChange,
}: {
  kind: ExpenseKind;
  onChange: (kind: ExpenseKind) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full border border-smoke bg-mist p-1">
      {(["expense", "income"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={kind === option}
          className={cn(
            "tap rounded-full px-3 py-2 text-xs font-semibold capitalize",
            kind === option
              ? "bg-ink text-paper"
              : "text-ash hover:text-ink",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function AmountField({
  value,
  onChange,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-center gap-1 rounded-[1.5rem] border border-smoke bg-mist px-4 py-4">
      <span className="text-2xl font-bold text-ash">₹</span>
      <input
        autoFocus={autoFocus}
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Amount in rupees"
        className="w-full min-w-0 bg-transparent text-center text-[2.2rem] font-extrabold leading-none tracking-[-0.04em] outline-none placeholder:text-ash/50"
      />
    </div>
  );
}

export function ExpenseSheet({
  editing,
  defaultDate,
  busy,
  onClose,
  onSave,
}: {
  editing: ExpenseRecord | null;
  defaultDate: string;
  busy: boolean;
  onClose: () => void;
  onSave: (input: ExpenseInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<ExpenseKind>(editing?.kind ?? "expense");
  const [amount, setAmount] = useState(
    editing ? formatAmountInput(editing.amount) : "",
  );
  const [category, setCategory] = useState(
    editing?.category ?? categoriesFor(kind)[0],
  );
  const [date, setDate] = useState(editing?.date ?? defaultDate);
  const [payment, setPayment] = useState<PaymentMethod>(
    editing?.payment ?? "upi",
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const title =
    kind === "income"
      ? editing
        ? "Edit income"
        : "Add income"
      : editing
        ? "Edit expense"
        : "Add expense";

  function changeKind(next: ExpenseKind) {
    setKind(next);
    if (!categoriesFor(next).includes(category)) {
      setCategory(categoriesFor(next)[0]);
    }
  }

  async function save() {
    const paise = parseAmount(amount);
    if (!paise) {
      setError("Enter an amount above zero.");
      return;
    }
    if (!date) {
      setError("Pick a date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        date,
        kind,
        amount: paise,
        category,
        payment,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this entry.");
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || saving;

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      description="Stored unencrypted, like your new money view."
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
            {saving ? "Saving…" : `Save · ₹${amount || "0"}`}
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

        <KindToggle kind={kind} onChange={changeKind} />

        <div className="space-y-1.5">
          <p className={labelClass}>Amount</p>
          <AmountField value={amount} onChange={setAmount} autoFocus />
        </div>

        <div className="space-y-2">
          <p className={labelClass}>Category</p>
          <CategoryPicker kind={kind} value={category} onChange={setCategory} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="expense-date">
              Date
            </label>
            <input
              id="expense-date"
              type="date"
              className={inputClass}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="expense-note">
              Note
            </label>
            <input
              id="expense-note"
              className={inputClass}
              placeholder="Optional"
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className={labelClass}>Payment</p>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_METHODS.map((method) => {
              const meta = PAYMENT_META[method];
              const active = payment === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPayment(method)}
                  aria-pressed={active}
                  className={cn(
                    "tap inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-smoke bg-paper text-ink hover:bg-mist",
                  )}
                >
                  <meta.Icon className="h-3.5 w-3.5" aria-hidden />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** Compact expense capture shown after closing a newly written journal entry. */
export function QuickExpenseSheet({
  date,
  payment,
  busy,
  onSkip,
  onSave,
}: {
  date: string;
  payment: PaymentMethod;
  busy: boolean;
  onSkip: () => void;
  onSave: (input: ExpenseInput) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categoriesFor("expense")[0]);
  const [note, setNote] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(payment);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const paise = parseAmount(amount);
    if (!paise) {
      setError("Enter an amount above zero, or skip.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        date,
        kind: "expense",
        amount: paise,
        category,
        payment: selectedPayment,
        note: note.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this expense.");
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || saving;

  return (
    <Sheet
      open
      onClose={onSkip}
      title="Log today's expense?"
      description="Quick capture for your money view. Skipping is fine."
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="tap rounded-full border border-smoke px-4 py-2.5 text-sm font-medium"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={save}
            disabled={disabled}
            className="tap ml-auto rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add expense"}
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
        <AmountField value={amount} onChange={setAmount} autoFocus />
        <CategoryPicker
          kind="expense"
          value={category}
          onChange={setCategory}
        />
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHODS.map((method) => {
            const meta = PAYMENT_META[method];
            const active = selectedPayment === method;
            return (
              <button
                key={method}
                type="button"
                onClick={() => setSelectedPayment(method)}
                aria-pressed={active}
                className={cn(
                  "tap inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-smoke bg-paper text-ink hover:bg-mist",
                )}
              >
                <meta.Icon className="h-3.5 w-3.5" aria-hidden />
                {meta.label}
              </button>
            );
          })}
        </div>
        <input
          className={inputClass}
          placeholder="Note (optional)"
          maxLength={200}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Sheet>
  );
}
