import { describe, expect, it } from "vitest";
import { buildSearchIndex } from "./search";
import type { DecryptedEntry } from "./types";

function entry(overrides: Partial<DecryptedEntry>): DecryptedEntry {
  return {
    id: "id",
    date: "2026-01-01",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 0,
    cryptoVersion: 1,
    title: "",
    markdown: "",
    tags: [],
    ...overrides,
  };
}

const entries = [
  entry({ id: "a", title: "Morning", markdown: "Coffee and gingerbread", tags: ["food"] }),
  entry({ id: "b", title: "Evening", markdown: "Long walk by the river", tags: ["nature"] }),
];

describe("buildSearchIndex", () => {
  it("finds entries by title, body and tag", () => {
    const index = buildSearchIndex(entries);
    expect(index.search("ginger")).toContain("a");
    expect(index.search("river")).toContain("b");
    expect(index.search("nature")).toContain("b");
  });

  it("returns nothing for a blank query", () => {
    const index = buildSearchIndex(entries);
    expect(index.search("   ")).toEqual([]);
  });
});
