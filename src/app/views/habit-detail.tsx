"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import type { DecryptedHabit } from "@/lib/types";
import { habitStreak, monthGrid } from "@/lib/habits";
import { plural } from "@/lib/format";
import { HabitGlyph, habitColorMeta } from "../habit-meta";
import { iconButtonClass } from "../ui";
import { cn } from "../cn";

/** Monday-first weekday initials, matching `monthGrid`. */
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

interface Props {
  habit: DecryptedHabit;
  onBack: () => void;
  onEdit: () => void;
}

/** One habit's month calendar. Read-only — check-ins happen on the habit card. */
export function HabitDetail({ habit, onBack, onEdit }: Props) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const color = habitColorMeta(habit.color);
  const streak = habitStreak(habit.completions);
  const weeks = monthGrid(
    habit.completions,
    cursor.getFullYear(),
    cursor.getMonth(),
    today,
  );
  const isCurrentMonth =
    cursor.getFullYear() === today.getFullYear() &&
    cursor.getMonth() === today.getMonth();

  function shiftMonth(delta: number) {
    setCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to habits"
          className={iconButtonClass}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>

        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#09090b]",
            color.bg,
          )}
        >
          <HabitGlyph name={habit.icon} className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-[-0.02em]">
            {habit.name}
          </h1>
          <p className="mt-0.5 text-[0.68rem] font-medium text-ash">
            {streak} {plural(streak, "day")} streak
          </p>
        </div>

        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${habit.name}`}
          className={iconButtonClass}
        >
          <Pencil className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        </button>
      </header>

      <section
        className="rounded-[1.75rem] border border-smoke bg-paper p-4 sm:p-5"
        aria-label={`${habit.name} calendar`}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="tap grid h-9 w-9 place-items-center rounded-full border border-smoke text-ink hover:bg-mist"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          <p
            aria-live="polite"
            className="text-sm font-semibold tracking-tight"
          >
            {cursor.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="tap grid h-9 w-9 place-items-center rounded-full border border-smoke text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((label, index) => (
            <span
              key={index}
              aria-hidden
              className="pb-1 text-center text-[0.6rem] font-bold uppercase tracking-wide text-ash"
            >
              {label}
            </span>
          ))}

          {weeks.flatMap((week, weekIndex) =>
            week.map((cell, dayIndex) => {
              if (!cell) {
                return (
                  <span
                    key={`blank-${weekIndex}-${dayIndex}`}
                    aria-hidden
                  />
                );
              }

              const label = cell.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              });
              const state = cell.done
                ? "completed"
                : cell.isFuture
                  ? "upcoming"
                  : "not completed";

              return (
                <span
                  key={cell.key}
                  title={`${label} — ${state}`}
                  aria-label={`${label}, ${state}`}
                  className={cn(
                    "grid aspect-square place-items-center rounded-xl text-[0.72rem] font-semibold tabular-nums",
                    cell.done
                      ? cn(color.bg, "text-[#09090b]")
                      : cell.isFuture
                        ? "text-ash/45"
                        : "bg-mist text-ink/75",
                    cell.isToday &&
                      "ring-2 ring-ink ring-offset-2 ring-offset-paper",
                  )}
                >
                  {cell.dayOfMonth}
                </span>
              );
            }),
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-smoke pt-3 text-[0.62rem] font-medium text-ash">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-[4px]", color.bg)} aria-hidden />
            Done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[4px] bg-mist ring-1 ring-smoke" aria-hidden />
            Not done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[4px] bg-paper ring-2 ring-ink" aria-hidden />
            Today
          </span>
        </div>
      </section>

      <p className="px-1 pb-2 text-center text-[0.66rem] leading-relaxed text-ash">
        Your calendar is a read-only record. Check in from the habit card.
      </p>
    </div>
  );
}
