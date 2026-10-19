/**
 * Streak + activity statistics derived from entry dates.
 *
 * Entry dates are plain `YYYY-MM-DD` calendar days in the user's local time, so
 * everything here works with local-time `Date` objects and never touches UTC.
 */

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse a local `YYYY-MM-DD` key back into a local-time Date. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Number of entries per calendar day, keyed by `YYYY-MM-DD`. */
export function entryCountsByDate(
  entries: Array<{ date: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.date) continue;
    counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
  }
  return counts;
}

/**
 * Consecutive days with at least one entry, counting back from today. An empty
 * today does not break the streak until tomorrow (a one-day grace), matching how
 * people usually read their own streaks.
 */
export function currentStreak(
  counts: Map<string, number>,
  today: Date = new Date(),
): number {
  let cursor = startOfDay(today);
  if (!counts.has(dateKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!counts.has(dateKey(cursor))) return 0;
  }
  let streak = 0;
  while (counts.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** The longest run of consecutive days with entries, across all history. */
export function longestStreak(counts: Map<string, number>): number {
  const keys = [...counts.keys()]
    .filter((key) => (counts.get(key) ?? 0) > 0)
    .sort();

  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of keys) {
    const date = parseDateKey(key);
    if (previous && dateKey(addDays(previous, 1)) === key) run += 1;
    else run = 1;
    if (run > best) best = run;
    previous = date;
  }
  return best;
}

export interface HeatCell {
  key: string;
  date: Date;
  count: number;
  /** 0–4 shading bucket. */
  level: number;
  /** False for the padded days after today. */
  inRange: boolean;
}

export interface Heatmap {
  /** One entry per week; each holds 7 cells, Sunday → Saturday. */
  columns: HeatCell[][];
  /** Month labels keyed by the column where that month first appears. */
  monthLabels: Array<{ column: number; label: string }>;
}

/** Map a day's entry count onto one of five shading levels. */
export function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * Build a GitHub-style contribution grid: `weeks` columns, each a full
 * Sunday → Saturday week, ending with the week that contains `end`.
 */
export function buildHeatmap(
  counts: Map<string, number>,
  options: { weeks?: number; end?: Date } = {},
): Heatmap {
  const weeks = options.weeks ?? 15;
  const end = startOfDay(options.end ?? new Date());
  const endSunday = addDays(end, -end.getDay());
  const startSunday = addDays(endSunday, -(weeks - 1) * 7);

  const columns: HeatCell[][] = [];
  const monthLabels: Array<{ column: number; label: string }> = [];
  let previousMonth = -1;

  for (let column = 0; column < weeks; column += 1) {
    const cells: HeatCell[] = [];
    for (let row = 0; row < 7; row += 1) {
      const date = addDays(startSunday, column * 7 + row);
      const key = dateKey(date);
      const count = counts.get(key) ?? 0;
      cells.push({
        key,
        date,
        count,
        level: levelFor(count),
        inRange: date.getTime() <= end.getTime(),
      });
    }
    columns.push(cells);

    const month = cells[0].date.getMonth();
    if (month !== previousMonth) {
      monthLabels.push({
        column,
        label: cells[0].date.toLocaleDateString(undefined, { month: "short" }),
      });
      previousMonth = month;
    }
  }

  return { columns, monthLabels };
}
