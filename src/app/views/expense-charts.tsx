"use client";

import { useId } from "react";
import { formatMoney, type MoneyBucket } from "@/lib/expenses";
import type { ExpenseKind } from "@/lib/types";
import { categoryMeta } from "../expense-meta";
import { cn } from "../cn";

/** Soft area line for the selected period's daily/monthly spending. */
export function SpendingTrend({ buckets }: { buckets: MoneyBucket[] }) {
  const gradientId = useId();
  const values = buckets.map((bucket) => bucket.expense);
  const max = Math.max(1, ...values);
  const width = 320;
  const top = 8;
  const baseline = 84;
  const step = buckets.length > 1 ? (width - 12) / (buckets.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = buckets.length > 1 ? 6 + step * index : width / 2;
    const y = baseline - (value / max) * (baseline - top);
    return { x, y, value };
  });

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  const area =
    points.length > 0
      ? `${line} L${points[points.length - 1].x} ${baseline} L${points[0].x} ${baseline} Z`
      : "";

  const labelEvery = Math.max(1, Math.ceil(buckets.length / 5));

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} 96`}
        className="h-24 w-full"
        role="img"
        aria-label={`Spending trend: ${buckets.length} points, highest ${formatMoney(Math.max(...values))}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c9f75a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#c9f75a" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1="6"
          x2={width - 6}
          y1={baseline}
          y2={baseline}
          stroke="currentColor"
          className="text-smoke"
          strokeWidth="1"
        />
        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke="#7fd12f"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((point, index) => (
          <circle
            key={buckets[index].key}
            cx={point.x}
            cy={point.y}
            r={point.value > 0 ? 2.5 : 1.5}
            fill={point.value > 0 ? "currentColor" : "#a1a1aa"}
          >
            <title>
              {`${buckets[index].label}: ${formatMoney(point.value)} spent`}
            </title>
          </circle>
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[0.6rem] font-medium text-ash">
        {buckets.map((bucket, index) =>
          index % labelEvery === 0 || index === buckets.length - 1 ? (
            <span key={bucket.key}>{bucket.label}</span>
          ) : null,
        )}
      </div>
    </div>
  );
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Category donut built from stroke dashes — no chart dependency. */
export function CategoryDonut({
  slices,
  total,
}: {
  slices: DonutSlice[];
  total: number;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative grid h-40 w-40 shrink-0 place-items-center">
      <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-smoke"
            strokeWidth="16"
          />
        {slices.map((slice, index) => {
          const fraction = total > 0 ? slice.value / total : 0;
          const length = fraction * circumference;
          const dash = `${Math.max(0, length - 1.5)} ${circumference}`;
          const dashOffset = -slices
            .slice(0, index)
            .reduce(
              (sum, previous) =>
                sum + (total > 0 ? previous.value / total : 0) * circumference,
              0,
            );
          return (
            <circle
              key={slice.key}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
            >
              <title>{`${slice.label}: ${formatMoney(slice.value)}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="absolute text-center">
        <p className="text-lg font-extrabold tracking-tight tabular-nums">
          {formatMoney(total)}
        </p>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ash">
          spent
        </p>
      </div>
    </div>
  );
}

export interface BreakdownItem {
  category: string;
  amount: number;
}

/** Category rows with share bars, optionally measured against a budget. */
export function CategoryBreakdown({
  items,
  total,
  kind,
  budgets,
}: {
  items: BreakdownItem[];
  total: number;
  kind: ExpenseKind;
  budgets?: Record<string, number>;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-smoke px-4 py-6 text-center text-xs text-ash">
        Nothing in this period yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3.5">
      {items.map((item) => {
        const meta = categoryMeta(item.category, kind);
        const budget = budgets?.[item.category] ?? 0;
        const share = total > 0 ? (item.amount / total) * 100 : 0;
        const used = budget > 0 ? (item.amount / budget) * 100 : share;
        const over = budget > 0 && item.amount > budget;

        return (
          <li key={item.category}>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#09090b]",
                  meta.bg,
                )}
              >
                <meta.Icon className="h-4 w-4" strokeWidth={2.1} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
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
                  width: `${Math.min(100, Math.max(0, used))}%`,
                  backgroundColor: over ? "#dc2626" : meta.hex,
                }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[0.6rem] font-medium text-ash">
              <span>
                {budget > 0
                  ? `${Math.round(used)}% of ${formatMoney(budget)}`
                  : `${Math.round(share)}% of spending`}
              </span>
              {over && <span className="text-red-500">Over budget</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
