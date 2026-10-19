"use client";

import { useMemo } from "react";
import {
  ArrowUpRight,
  Award,
  CalendarDays,
  Flame as FlameIcon,
  Grid3x3,
  TrendingUp,
} from "lucide-react";
import type { DecryptedEntry } from "@/lib/types";
import {
  currentStreak,
  entryCountsByDate,
  longestStreak,
} from "@/lib/streaks";
import { nextMilestone, lastDays } from "@/lib/habits";
import { plural } from "@/lib/format";
import { Flame } from "../flame";
import { ActivityHeatmap } from "../heatmap";
import { accentButtonClass } from "../ui";
import { cn } from "../cn";

interface Props {
  entries: DecryptedEntry[];
  onWrite: () => void;
}

const STAT_STYLES = [
  "bg-accent-sky",
  "bg-accent-pink",
  "bg-accent-butter",
  "bg-accent-lilac",
];

/** A dedicated streak page: animated flame, green grid and milestones. */
export function StreakView({ entries, onWrite }: Props) {
  const stats = useMemo(() => {
    const counts = entryCountsByDate(entries);
    return {
      counts,
      current: currentStreak(counts),
      longest: longestStreak(counts),
      activeDays: counts.size,
      total: entries.length,
    };
  }, [entries]);

  const monthKey = new Date().toISOString().slice(0, 7);
  const thisMonth = entries.filter((entry) => entry.date.startsWith(monthKey)).length;
  const milestone = nextMilestone(stats.current);
  const week = useMemo(() => lastDays(7, [], new Date()), []);
  const weekCounts = week.map((day) => stats.counts.get(day.key) ?? 0);
  const maxWeek = Math.max(1, ...weekCounts);

  return (
    <div className="animate-view space-y-4">
      <header>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ash">
          Consistency, not perfection
        </p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-[1.05] tracking-[-0.045em]">
          Your streak
        </h1>
        <p className="mt-1 text-sm text-ash">
          Every square is a day you showed up.
        </p>
      </header>

      <section className="relative overflow-hidden rounded-[2rem] bg-ink p-5 text-paper sm:p-6">
        <span
          aria-hidden
          className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent-lime/20 blur-2xl"
        />
        <span
          aria-hidden
          className="absolute -bottom-24 -left-12 h-44 w-44 rounded-full border-[18px] border-paper/5"
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-paper/55">
              Current streak
            </p>
            <div className="mt-1 flex items-end gap-2">
              <span
                key={stats.current}
                className="animate-pop text-[4.2rem] font-extrabold leading-[0.85] tracking-[-0.07em] tabular-nums"
              >
                {stats.current}
              </span>
              <span className="pb-1.5 text-sm font-semibold text-paper/65">
                {plural(stats.current, "day")}
              </span>
            </div>
            <p className="mt-3 max-w-[15rem] text-sm leading-snug text-paper/60">
              {stats.current > 0
                ? "The thread is holding. One line today keeps it going."
                : "A fresh start. Write one line to light the flame."}
            </p>
            <button
              type="button"
              onClick={onWrite}
              className="tap mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-lime px-3.5 py-2 text-xs font-bold text-[#09090b]"
            >
              {stats.current > 0 ? "Write today" : "Start the streak"}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="relative mt-1 grid h-24 w-24 shrink-0 place-items-center rounded-full bg-accent-lime text-[#09090b] sm:h-28 sm:w-28">
            <span
              aria-hidden
              className="absolute inset-1 rounded-full border border-[#09090b]/15"
            />
            <Flame className="h-14 w-14 sm:h-16 sm:w-16" glow animated />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5" aria-label="Streak stats">
        <StatCard
          className={STAT_STYLES[0]}
          label="Longest streak"
          value={stats.longest}
          suffix={plural(stats.longest, "day")}
          icon={<Award className="h-4 w-4" strokeWidth={2.2} aria-hidden />}
        />
        <StatCard
          className={STAT_STYLES[1]}
          label="Active days"
          value={stats.activeDays}
          suffix="days written"
          icon={<CalendarDays className="h-4 w-4" strokeWidth={2.2} aria-hidden />}
        />
        <StatCard
          className={STAT_STYLES[2]}
          label="This month"
          value={thisMonth}
          suffix={plural(thisMonth, "entry", "entries")}
          icon={<TrendingUp className="h-4 w-4" strokeWidth={2.2} aria-hidden />}
        />
        <StatCard
          className={STAT_STYLES[3]}
          label="All time"
          value={stats.total}
          suffix={plural(stats.total, "entry", "entries")}
          icon={<Grid3x3 className="h-4 w-4" strokeWidth={2.2} aria-hidden />}
        />
      </section>

      <section className="rounded-[1.75rem] border border-smoke bg-paper p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Your green grid
            </h2>
            <p className="mt-0.5 text-xs text-ash">
              The last {16} weeks, shaded by how much you wrote.
            </p>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-lime text-[#09090b]">
            <FlameIcon className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </span>
        </div>

        {entries.length > 0 ? (
          <ActivityHeatmap counts={stats.counts} />
        ) : (
          <div className="rounded-2xl border border-dashed border-smoke px-4 py-8 text-center">
            <p className="text-sm font-semibold">No green yet.</p>
            <p className="mt-1 text-xs text-ash">
              Your first entry plants the first square.
            </p>
            <button
              type="button"
              onClick={onWrite}
              className={cn(accentButtonClass, "mt-4 px-4 py-2 text-xs")}
            >
              Write an entry
            </button>
          </div>
        )}

        {entries.length > 0 && (
          <div className="mt-5 border-t border-smoke pt-4">
            <div className="flex items-center justify-between">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ash">
                Last 7 days
              </p>
              <p className="text-[0.68rem] font-semibold text-ash">
                {weekCounts.filter((count) => count > 0).length}/7 active
              </p>
            </div>
            <div className="mt-3 flex items-end gap-1.5">
              {week.map((day, index) => {
                const count = weekCounts[index];
                const height = count > 0 ? 22 + (count / maxWeek) * 38 : 6;
                return (
                  <div key={day.key} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-16 w-full items-end">
                      <span
                        className={cn(
                          "w-full rounded-md transition-[height] duration-500",
                          count > 0
                            ? "bg-accent-green"
                            : "bg-smoke",
                          day.isToday && "ring-1 ring-ink/40",
                        )}
                        style={{ height }}
                        title={`${count} ${plural(count, "entry", "entries")}`}
                      />
                    </div>
                    <span className="text-[0.58rem] font-semibold uppercase tracking-wide text-ash">
                      {day.letter}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] bg-accent-lime p-5 text-[#09090b]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#09090b]/55">
              Next milestone
            </p>
            <p className="mt-1 text-3xl font-extrabold tracking-[-0.04em] tabular-nums">
              {milestone.target} days
            </p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#09090b] text-accent-lime">
            <Award className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#09090b]/15">
          <div
            className="h-full rounded-full bg-[#09090b] transition-[width] duration-700"
            style={{ width: `${Math.round(milestone.progress * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-[#09090b]/65">
          {milestone.remaining > 0
            ? `${milestone.remaining} ${plural(milestone.remaining, "day")} to go — you're ${
                Math.round(milestone.progress * 100)
              }% there.`
            : "Milestone reached. Time for the next one."}
        </p>
      </section>
    </div>
  );
}

function StatCard({
  className,
  label,
  value,
  suffix,
  icon,
}: {
  className: string;
  label: string;
  value: number;
  suffix: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[1.4rem] p-4 text-[#09090b]", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#09090b]/55">
          {label}
        </p>
        <span className="text-[#09090b]/55">{icon}</span>
      </div>
      <p className="mt-2 text-[1.65rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[0.66rem] font-medium text-[#09090b]/55">{suffix}</p>
    </div>
  );
}
