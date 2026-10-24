import { describe, expect, it } from "vitest";
import {
  bucketSeries,
  budgetProgress,
  categoryTotals,
  daysInRange,
  daysLeftInMonth,
  filterByRange,
  formatAmountInput,
  formatMoney,
  moneyToBackup,
  monthKeyFor,
  monthRange,
  parseAmount,
  parseMoneyBackup,
  periodRange,
  previousRange,
  shiftPeriod,
  totalsFor,
} from "./expenses";
import type { BudgetRecord, ExpenseRecord } from "./types";

const march12 = new Date(2026, 2, 12); // Thursday, 12 Mar 2026

function expense(
  overrides: Partial<ExpenseRecord> = {},
): ExpenseRecord {
  return {
    id: overrides.id ?? "expense",
    date: "2026-03-12",
    kind: "expense",
    amount: 1000,
    category: "food",
    payment: "upi",
    note: "",
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    ...overrides,
  };
}

describe("periodRange", () => {
  it("handles a single day", () => {
    const range = periodRange("day", march12);
    expect(range.from).toBe("2026-03-12");
    expect(range.to).toBe("2026-03-12");
  });

  it("runs Monday to Sunday for a week", () => {
    const range = periodRange("week", march12);
    expect(range.from).toBe("2026-03-09");
    expect(range.to).toBe("2026-03-15");
  });

  it("runs the first to the last day of a month", () => {
    const range = periodRange("month", march12);
    expect(range.from).toBe("2026-03-01");
    expect(range.to).toBe("2026-03-31");
  });

  it("runs January to December for a year", () => {
    const range = periodRange("year", march12);
    expect(range.from).toBe("2026-01-01");
    expect(range.to).toBe("2026-12-31");
  });
});

describe("shiftPeriod", () => {
  it("steps months without overflowing into the next one", () => {
    const jan31 = new Date(2026, 0, 31);
    expect(monthKeyFor(shiftPeriod(jan31, "month", 1))).toBe("2026-02");
    expect(monthKeyFor(shiftPeriod(jan31, "month", -1))).toBe("2025-12");
  });

  it("steps days, weeks and years", () => {
    expect(periodRange("day", shiftPeriod(march12, "day", -1)).from).toBe(
      "2026-03-11",
    );
    expect(periodRange("week", shiftPeriod(march12, "week", -1)).from).toBe(
      "2026-03-02",
    );
    expect(periodRange("year", shiftPeriod(march12, "year", 1)).from).toBe(
      "2027-01-01",
    );
  });
});

describe("filterByRange / previousRange", () => {
  it("keeps only inclusive dates", () => {
    const records = [
      expense({ date: "2026-02-28" }),
      expense({ date: "2026-03-01" }),
      expense({ date: "2026-03-31" }),
      expense({ date: "2026-04-01" }),
    ];
    expect(
      filterByRange(records, "2026-03-01", "2026-03-31").map((r) => r.date),
    ).toEqual(["2026-03-01", "2026-03-31"]);
  });

  it("points at the prior period", () => {
    expect(previousRange("month", march12).from).toBe("2026-02-01");
    expect(previousRange("month", march12).to).toBe("2026-02-28");
  });
});

describe("totalsFor", () => {
  it("splits income, expenses, net and the largest expense", () => {
    const totals = totalsFor([
      expense({ amount: 5000 }),
      expense({ amount: 2500, kind: "income", category: "salary" }),
      expense({ amount: 9000, category: "bills" }),
    ]);
    expect(totals.income).toBe(2500);
    expect(totals.expense).toBe(14000);
    expect(totals.net).toBe(-11500);
    expect(totals.count).toBe(3);
    expect(totals.largestExpense).toBe(9000);
  });

  it("is all zeroes for no records", () => {
    expect(totalsFor([])).toEqual({
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
      largestExpense: 0,
    });
  });
});

describe("categoryTotals", () => {
  it("groups one kind and sorts biggest first", () => {
    const records = [
      expense({ category: "food", amount: 1000 }),
      expense({ category: "bills", amount: 3000 }),
      expense({ category: "food", amount: 2000 }),
      expense({ category: "salary", kind: "income", amount: 9000 }),
    ];
    expect(categoryTotals(records, "expense")).toEqual([
      { category: "bills", amount: 3000 },
      { category: "food", amount: 3000 },
    ]);
    expect(categoryTotals(records, "income")).toEqual([
      { category: "salary", amount: 9000 },
    ]);
  });
});

describe("bucketSeries", () => {
  it("gives seven day buckets for a week and sums both kinds", () => {
    const buckets = bucketSeries(
      [
        expense({ date: "2026-03-09", amount: 1000 }),
        expense({ date: "2026-03-12", amount: 2500, kind: "income" }),
        expense({ date: "2026-03-12", amount: 500 }),
        expense({ date: "2026-03-20", amount: 9999 }),
      ],
      "week",
      march12,
    );
    expect(buckets).toHaveLength(7);
    expect(buckets[0].expense).toBe(1000);
    expect(buckets[3].income).toBe(2500);
    expect(buckets[3].expense).toBe(500);
    expect(buckets.reduce((sum, b) => sum + b.expense, 0)).toBe(1500);
  });

  it("has one bucket per day in a month and twelve per year", () => {
    expect(bucketSeries([], "month", march12)).toHaveLength(31);
    expect(bucketSeries([], "year", march12)).toHaveLength(12);
  });

  it("groups the year by month", () => {
    const buckets = bucketSeries(
      [
        expense({ date: "2026-01-05", amount: 1000 }),
        expense({ date: "2026-01-20", amount: 2000 }),
        expense({ date: "2026-12-31", amount: 500, kind: "income" }),
      ],
      "year",
      march12,
    );
    expect(buckets[0].expense).toBe(3000);
    expect(buckets[11].income).toBe(500);
  });
});

describe("date maths", () => {
  it("counts inclusive days", () => {
    expect(daysInRange("2026-03-01", "2026-03-31")).toBe(31);
    expect(daysInRange("2026-03-12", "2026-03-12")).toBe(1);
    expect(daysInRange("2028-02-01", "2028-02-29")).toBe(29);
  });

  it("derives month keys and ranges", () => {
    expect(monthKeyFor(march12)).toBe("2026-03");
    expect(monthRange("2026-02")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(monthRange("2028-02").to).toBe("2028-02-29");
  });

  it("counts days left in the budget month", () => {
    expect(daysLeftInMonth("2026-03", march12)).toBe(19);
    expect(daysLeftInMonth("2026-02", march12)).toBe(0);
    expect(daysLeftInMonth("2026-04", march12)).toBe(30);
  });
});

describe("money formatting", () => {
  it("formats whole and fractional rupees", () => {
    expect(formatMoney(184700)).toMatch(/1,847/);
    expect(formatMoney(184750)).toMatch(/1,847\.50/);
    expect(formatAmountInput(184700)).toBe("1847");
    expect(formatAmountInput(4250)).toBe("42.50");
  });

  it("parses decimal input into paise", () => {
    expect(parseAmount("42")).toBe(4200);
    expect(parseAmount("42.5")).toBe(4250);
    expect(parseAmount("₹1,847.50")).toBe(184750);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("budgetProgress", () => {
  it("tracks remaining and over-budget amounts", () => {
    expect(budgetProgress(68200, 78000)).toMatchObject({
      remaining: 9800,
      over: 0,
    });
    expect(budgetProgress(90000, 78000)).toMatchObject({
      remaining: 0,
      over: 12000,
    });
    expect(budgetProgress(90000, 78000).percent).toBe(1);
  });

  it("treats a missing budget as zero percent", () => {
    expect(budgetProgress(500, 0).percent).toBe(0);
  });
});

describe("money backup", () => {
  const budgets: BudgetRecord[] = [
    {
      month: "2026-03",
      total: 350000,
      categories: { food: 78000 },
      updatedAt: "2026-03-12T10:00:00.000Z",
    },
  ];

  it("round-trips expenses and budgets", () => {
    const expenses = [expense(), expense({ kind: "income", amount: 9000 })];
    const parsed = parseMoneyBackup(moneyToBackup(expenses, budgets));
    expect(parsed.expenses).toHaveLength(2);
    expect(parsed.budgets[0].month).toBe("2026-03");
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseMoneyBackup("not json")).toThrow();
    expect(() => parseMoneyBackup('{"kind":"encrypted-backup"}')).toThrow();
  });
});
