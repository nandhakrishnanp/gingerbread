import { describe, expect, it } from "vitest";
import {
  completionRate,
  habitBestStreak,
  habitStreak,
  isCompletedToday,
  lastDays,
  nextMilestone,
  normalizeCompletions,
  toggleCompletion,
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

describe("nextMilestone", () => {
  it("points at the next target and tracks progress", () => {
    expect(nextMilestone(5)).toMatchObject({ target: 7, remaining: 2 });
    expect(nextMilestone(7).target).toBe(14);
    expect(nextMilestone(0).target).toBe(3);
  });
});
