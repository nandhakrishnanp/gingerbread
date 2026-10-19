"use client";

import { useMemo } from "react";
import {
  buildHeatmap,
  currentStreak,
  entryCountsByDate,
  longestStreak,
} from "@/lib/streaks";
import type { DecryptedEntry } from "@/lib/types";

/** Five monochrome shading levels, empty → busiest. */
const LEVEL_CLASS = [
  "bg-black/[0.06] dark:bg-white/[0.08]",
  "bg-black/20 dark:bg-white/25",
  "bg-black/40 dark:bg-white/45",
  "bg-black/65 dark:bg-white/70",
  "bg-black/90 dark:bg-white/90",
];

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const WEEKS = 15;
/** Width of the weekday rail (w-8 = 32px) plus the 3px gap. */
const GRID_OFFSET = "pl-[35px]";

export function ActivityHeatmap({ entries }: { entries: DecryptedEntry[] }) {
  const stats = useMemo(() => {
    const counts = entryCountsByDate(entries);
    return {
      counts,
      current: currentStreak(counts),
      longest: longestStreak(counts),
      total: entries.length,
    };
  }, [entries]);

  const heatmap = useMemo(() => buildHeatmap(stats.counts, { weeks: WEEKS }), [stats.counts]);

  const labelByColumn = useMemo(() => {
    const map = new Map<number, string>();
    for (const { column, label } of heatmap.monthLabels) map.set(column, label);
    return map;
  }, [heatmap.monthLabels]);

  if (entries.length === 0) return null;

  return (
    <section className="border-b border-black/10 py-5 dark:border-white/15">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Stat label="Current streak" value={stats.current} suffix={stats.current === 1 ? "day" : "days"} />
        <Stat label="Longest streak" value={stats.longest} suffix={stats.longest === 1 ? "day" : "days"} />
        <Stat label="Entries" value={stats.total} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          <div className={`flex gap-[3px] ${GRID_OFFSET}`}>
            {heatmap.columns.map((_, column) => (
              <span
                key={column}
                className="w-3 overflow-visible whitespace-nowrap text-[10px] leading-3 opacity-50"
              >
                {labelByColumn.get(column) ?? ""}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            <div className="flex w-8 flex-col gap-[3px] text-[10px] leading-3 opacity-50">
              {WEEKDAY_LABELS.map((label, row) => (
                <span key={row} className="flex h-3 items-center">
                  {label}
                </span>
              ))}
            </div>
            {heatmap.columns.map((column, index) => (
              <div key={index} className="flex flex-col gap-[3px]">
                {column.map((cell) => (
                  <span
                    key={cell.key}
                    title={`${cell.count} ${cell.count === 1 ? "entry" : "entries"} on ${cell.date.toLocaleDateString()}`}
                    className={`h-3 w-3 rounded-[2px] ${LEVEL_CLASS[cell.level]} ${
                      cell.inRange ? "" : "opacity-0"
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`mt-2 flex items-center gap-1.5 text-[10px] opacity-50 ${GRID_OFFSET}`}>
        <span>Less</span>
        {LEVEL_CLASS.map((cls, level) => (
          <span key={level} className={`h-3 w-3 rounded-[2px] ${cls}`} />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="text-xl font-semibold tabular-nums">
        {value}
        {suffix && <span className="ml-1 text-xs font-normal opacity-50">{suffix}</span>}
      </div>
      <div className="text-xs uppercase tracking-wide opacity-50">{label}</div>
    </div>
  );
}
