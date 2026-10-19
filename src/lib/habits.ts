/**
 * Pure habit logic: completion toggles, per-habit streaks and small calendar
 * helpers. Everything works with local-time `YYYY-MM-DD` keys, same as the
 * journal streak code.
 */
import { addDays, dateKey, startOfDay } from "./streaks";

export const HABIT_ICON_KEYS = [
  "flame",
  "book",
  "droplet",
  "dumbbell",
  "heart",
  "leaf",
  "music",
  "coffee",
  "brain",
  "footprints",
  "pencil",
  "sun",
  "moon",
  "code",
] as const;
export type HabitIconKey = (typeof HABIT_ICON_KEYS)[number];

export const HABIT_COLOR_KEYS = [
  "lime",
  "butter",
  "pink",
  "sky",
  "orange",
  "lilac",
  "mint",
] as const;
export type HabitColorKey = (typeof HABIT_COLOR_KEYS)[number];

export function isHabitIcon(value: unknown): value is HabitIconKey {
  return typeof value === "string" && (HABIT_ICON_KEYS as readonly string[]).includes(value);
}

export function isHabitColor(value: unknown): value is HabitColorKey {
  return typeof value === "string" && (HABIT_COLOR_KEYS as readonly string[]).includes(value);
}

/** Defensive coercion for decrypted habit payloads (and old/foreign data). */
export function normalizeCompletions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item)) {
      unique.add(item);
    }
  }
  return [...unique].sort();
}

export function isCompletedToday(
  completions: string[],
  today: Date = new Date(),
): boolean {
  return completions.includes(dateKey(today));
}

/** Add today, or remove it when it is already checked. */
export function toggleCompletion(
  completions: string[],
  today: Date = new Date(),
): string[] {
  const key = dateKey(today);
  return completions.includes(key)
    ? completions.filter((date) => date !== key)
    : [...completions, key].sort();
}

/**
 * Consecutive completion days ending today. Like the journal streak, an empty
 * today does not break the run until tomorrow — it gives a one-day grace.
 */
export function habitStreak(
  completions: string[],
  today: Date = new Date(),
): number {
  const done = new Set(completions);
  let cursor = startOfDay(today);
  if (!done.has(dateKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!done.has(dateKey(cursor))) return 0;
  }
  let streak = 0;
  while (done.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive completion days. */
export function habitBestStreak(completions: string[]): number {
  const keys = [...new Set(completions)].sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of keys) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (previous && dateKey(addDays(previous, 1)) === key) run += 1;
    else run = 1;
    if (run > best) best = run;
    previous = date;
  }
  return best;
}

export interface DayCell {
  key: string;
  date: Date;
  /** Single letter weekday, Monday-first locale-independent. */
  letter: string;
  dayOfMonth: number;
  isToday: boolean;
  done: boolean;
}

/** The last `count` days ending today, oldest first. */
export function lastDays(
  count: number,
  completions: string[] = [],
  today: Date = new Date(),
): DayCell[] {
  const done = new Set(completions);
  const end = startOfDay(today);
  const cells: DayCell[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = addDays(end, -offset);
    const key = dateKey(date);
    cells.push({
      key,
      date,
      letter: ["S", "M", "T", "W", "T", "F", "S"][date.getDay()],
      dayOfMonth: date.getDate(),
      isToday: offset === 0,
      done: done.has(key),
    });
  }
  return cells;
}

/** How many of the last `count` days (including today) are complete. */
export function completionRate(
  completions: string[],
  count = 7,
  today: Date = new Date(),
): number {
  return lastDays(count, completions, today).filter((day) => day.done).length;
}

export interface Milestone {
  target: number;
  progress: number;
  remaining: number;
  reached: boolean;
}

const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

/** The next meaningful streak milestone, for the progress card. */
export function nextMilestone(streak: number): Milestone {
  const target = MILESTONES.find((value) => value > streak) ?? 365;
  const previous = [...MILESTONES].reverse().find((value) => value <= streak) ?? 0;
  const span = Math.max(1, target - previous);
  return {
    target,
    progress: Math.min(1, Math.max(0, (streak - previous) / span)),
    remaining: Math.max(0, target - streak),
    reached: streak >= target,
  };
}
