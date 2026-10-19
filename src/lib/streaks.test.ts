import { describe, expect, it } from "vitest";
import {
  buildHeatmap,
  currentStreak,
  entryCountsByDate,
  longestStreak,
} from "./streaks";

function countsFrom(dates: string[]) {
  return entryCountsByDate(dates.map((date) => ({ date })));
}

describe("entryCountsByDate", () => {
  it("counts multiple entries on the same day", () => {
    const counts = countsFrom(["2026-03-01", "2026-03-01", "2026-03-02"]);
    expect(counts.get("2026-03-01")).toBe(2);
    expect(counts.get("2026-03-02")).toBe(1);
  });
});

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    const counts = countsFrom(["2026-03-10", "2026-03-11", "2026-03-12"]);
    expect(currentStreak(counts, new Date(2026, 2, 12))).toBe(3);
  });

  it("keeps the streak alive when today is empty but yesterday is not", () => {
    const counts = countsFrom(["2026-03-10", "2026-03-11"]);
    expect(currentStreak(counts, new Date(2026, 2, 12))).toBe(2);
  });

  it("is zero once the last entry is older than yesterday", () => {
    const counts = countsFrom(["2026-03-09"]);
    expect(currentStreak(counts, new Date(2026, 2, 12))).toBe(0);
  });
});

describe("longestStreak", () => {
  it("finds the longest run across all history", () => {
    const counts = countsFrom([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-10",
      "2026-03-11",
    ]);
    expect(longestStreak(counts)).toBe(3);
  });

  it("is zero with no entries", () => {
    expect(longestStreak(new Map())).toBe(0);
  });
});

describe("buildHeatmap", () => {
  it("builds full weeks ending in the week that contains the end date", () => {
    const counts = countsFrom(["2026-03-12"]);
    const heatmap = buildHeatmap(counts, { weeks: 2, end: new Date(2026, 2, 12) });

    expect(heatmap.columns).toHaveLength(2);
    expect(heatmap.columns.every((column) => column.length === 7)).toBe(true);

    const flat = heatmap.columns.flat();
    expect(flat.find((cell) => cell.key === "2026-03-12")?.count).toBe(1);
    // Days after the end date are padded out of range.
    expect(flat.find((cell) => cell.key === "2026-03-14")?.inRange).toBe(false);
    // Days before the end date are in range even without entries.
    expect(flat.find((cell) => cell.key === "2026-03-01")?.inRange).toBe(true);
  });
});
