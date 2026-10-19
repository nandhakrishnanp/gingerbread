"use client";

import { useMemo } from "react";
import { buildHeatmap, dateKey } from "@/lib/streaks";
import { cn } from "./cn";

/** Five green shading levels, empty → busiest. */
const LEVEL_CLASS = [
  "bg-black/[0.055] dark:bg-white/[0.07]",
  "bg-[#e7f9bd] dark:bg-[#28400c]",
  "bg-[#c9f26b] dark:bg-[#3f6b0d]",
  "bg-[#9fdd2f] dark:bg-[#6da913]",
  "bg-[#5f9c00] dark:bg-[#c9f75a]",
];

/** Sunday → Saturday; only alternate rows are labelled to stay compact. */
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

interface Props {
  /** Entry counts keyed by local `YYYY-MM-DD`. */
  counts: Map<string, number>;
  weeks?: number;
  className?: string;
}

/**
 * GitHub-style contribution grid, tuned for phones: sixteen green weeks that
 * fit a 320px viewport without horizontal scrolling.
 */
export function ActivityHeatmap({ counts, weeks = 16, className }: Props) {
  const heatmap = useMemo(
    () => buildHeatmap(counts, { weeks }),
    [counts, weeks],
  );

  const labelByColumn = useMemo(() => {
    const map = new Map<number, string>();
    for (const { column, label } of heatmap.monthLabels) map.set(column, label);
    return map;
  }, [heatmap.monthLabels]);

  const today = dateKey(new Date());

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex gap-[3px] pl-[31px]">
          {heatmap.columns.map((_, column) => (
            <span
              key={column}
              className="w-3 overflow-visible whitespace-nowrap text-[9px] leading-3 text-ash"
            >
              {labelByColumn.get(column) ?? ""}
            </span>
          ))}
        </div>

        <div className="flex gap-[3px]">
          <div className="flex w-7 flex-col gap-[3px] text-[9px] leading-3 text-ash">
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
                  title={`${cell.count} ${
                    cell.count === 1 ? "entry" : "entries"
                  } on ${cell.date.toLocaleDateString()}`}
                  className={cn(
                    "h-3 w-3 rounded-[3px]",
                    LEVEL_CLASS[cell.level],
                    cell.inRange ? "" : "opacity-0",
                    cell.key === today && "ring-1 ring-ink/50 ring-offset-1 ring-offset-paper",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 pl-[31px] text-[9px] text-ash">
        <span>Less</span>
        {LEVEL_CLASS.map((cls, level) => (
          <span key={level} className={cn("h-3 w-3 rounded-[3px]", cls)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
