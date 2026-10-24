import { describe, expect, it } from "vitest";
import {
  completionRate,
  habitBestStreak,
  habitStreak,
  isCompletedToday,
  lastDays,
  monthGrid,
  nextMilestone,
  normalizeCompletions,
  toggleCompletion,
  type MonthCell,
} from "./habits";

const today = new Date(2026, 2, 12); // 12 Mar 2026

describe("normalizeCompletions", () => {
  it("keeps valid unique dates and drops junk", () => {
    expect(
      normalizeCompletions(["2026-03-12", "junk", 4, "2026-03-12", "2026-03-11"]),
    ).toEqual(["2026-03-11", "2026-03-12"]);
    expect(normalizeCompletions(null)).toEqual([]);
  });
});

describe("toggleCompletion", () => {
  it("adds today and removes it again", () => {
    const once = toggleCompletion([], today);
    expect(once).toEqual(["2026-03-12"]);
    expect(isCompletedToday(once, today)).toBe(true);
    expect(toggleCompletion(once, today)).toEqual([]);
  });
});

describe("habitStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(habitStreak(["2026-03-10", "2026-03-11", "2026-03-12"], today)).toBe(3);
  });

  it("grants one grace day when today is still open", () => {
    expect(habitStreak(["2026-03-10", "2026-03-11"], today)).toBe(2);
  });

  it("breaks once the last completion is older than yesterday", () => {
    expect(habitStreak(["2026-03-09"], today)).toBe(0);
  });

  it("is zero with no completions", () => {
    expect(habitStreak([], today)).toBe(0);
  });
});

describe("habitBestStreak", () => {
  it("finds the longest historical run", () => {
    expect(
      habitBestStreak([
        "2026-02-01",
        "2026-02-02",
        "2026-02-03",
        "2026-02-10",
        "2026-02-11",
      ]),
    ).toBe(3);
  });
});

describe("lastDays", () => {
  it("returns the seven days ending today, oldest first", () => {
    const days = lastDays(7, ["2026-03-12"], today);
    expect(days).toHaveLength(7);
    expect(days[0].key).toBe("2026-03-06");
    expect(days[6].key).toBe("2026-03-12");
    expect(days[6].isToday).toBe(true);
    expect(days[6].done).toBe(true);
    expect(days[5].done).toBe(false);
  });

  it("counts completions in the window", () => {
    expect(
      completionRate(
        ["2026-03-10", "2026-03-11", "2026-03-12", "2026-02-01"],
        7,
        today,
      ),
    ).toBe(3);
  });
});

describe("monthGrid", () => {
  const cellsOf = (weeks: Array<Array<MonthCell | null>>) =>
    weeks.flat().filter((cell): cell is MonthCell => cell !== null);

  it("lays the month out Monday-first with leading padding", () => {
    // 1 March 2026 is a Sunday, so it sits in the last column.
    const weeks = monthGrid([], 2026, 2, today);
    expect(weeks).toHaveLength(6);
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0][6]?.key).toBe("2026-03-01");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("starts in column zero when the month begins on a Monday", () => {
    // 1 June 2026 is a Monday.
    const weeks = monthGrid([], 2026, 5, today);
    expect(weeks[0][0]?.key).toBe("2026-06-01");
  });

  it("includes every day of the month exactly once", () => {
    const cells = cellsOf(monthGrid([], 2026, 2, today));
    expect(cells).toHaveLength(31);
    expect(cells[0].key).toBe("2026-03-01");
    expect(cells[30].key).toBe("2026-03-31");
    expect(new Set(cells.map((cell) => cell.key)).size).toBe(31);
  });

  it("handles February in a leap year", () => {
    const cells = cellsOf(monthGrid([], 2028, 1, new Date(2028, 1, 12)));
    expect(cells).toHaveLength(29);
    expect(cells.at(-1)?.key).toBe("2028-02-29");
  });

  it("flags completed, today and future days", () => {
    const cells = cellsOf(
      monthGrid(["2026-03-01", "2026-03-10"], 2026, 2, today),
    );
    const byKey = new Map(cells.map((cell) => [cell.key, cell]));
    expect(byKey.get("2026-03-01")?.done).toBe(true);
    expect(byKey.get("2026-03-10")?.done).toBe(true);
    expect(byKey.get("2026-03-09")?.done).toBe(false);
    expect(byKey.get("2026-03-12")?.isToday).toBe(true);
    expect(byKey.get("2026-03-12")?.isFuture).toBe(false);
    expect(byKey.get("2026-03-13")?.isFuture).toBe(true);
    expect(byKey.get("2026-03-11")?.isFuture).toBe(false);
  });

  it("ignores completions from other months", () => {
    const cells = cellsOf(monthGrid(["2026-02-28"], 2026, 2, today));
    expect(cells.some((cell) => cell.done)).toBe(false);
  });
});

describe("nextMilestone", () => {
  it("points at the next target and tracks progress", () => {
    expect(nextMilestone(5)).toMatchObject({ target: 7, remaining: 2 });
    expect(nextMilestone(7).target).toBe(14);
    expect(nextMilestone(0).target).toBe(3);
  });
});
