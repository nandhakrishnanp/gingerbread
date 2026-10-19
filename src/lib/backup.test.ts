import { describe, expect, it } from "vitest";
import {
  entriesToBackup,
  entriesToMarkdown,
  orderEntries,
  parseBackup,
  stripMarkdown,
} from "./backup";
import type { DecryptedEntry, EntryRecord } from "./types";

const entry: DecryptedEntry = {
  id: "a",
  date: "2026-02-03",
  createdAt: "2026-02-03T08:00:00.000Z",
  updatedAt: "2026-02-03T09:00:00.000Z",
  version: 2,
  cryptoVersion: 1,
  title: "Snow day",
  markdown: "# Snow\n\nWe **built** a `fort` and drank [tea](https://example.com).",
  tags: ["winter", "home"],
};

const record: EntryRecord = {
  id: "a",
  date: "2026-02-03",
  createdAt: "2026-02-03T08:00:00.000Z",
  updatedAt: "2026-02-03T09:00:00.000Z",
  version: 2,
  cryptoVersion: 1,
  iv: "aXY=",
  wrappedKey: "d3JhcA==",
  ciphertext: "Y2lwaGVy",
};

describe("stripMarkdown", () => {
  it("removes formatting while keeping the words", () => {
    const text = stripMarkdown(entry.markdown);
    expect(text).toContain("Snow");
    expect(text).toContain("built");
    expect(text).toContain("fort");
    expect(text).toContain("tea");
    expect(text).not.toContain("**");
    expect(text).not.toContain("#");
    expect(text).not.toContain("https://");
  });
});

describe("entriesToMarkdown", () => {
  it("includes the title, date, tags and body", () => {
    const md = entriesToMarkdown([entry]);
    expect(md).toContain("# Snow day");
    expect(md).toContain("2026-02-03");
    expect(md).toContain("winter, home");
    expect(md).toContain("built");
  });
});

describe("encrypted backup", () => {
  it("round-trips entries and vault records", () => {
    const vault = [
      {
        id: "habit-1",
        kind: "habit" as const,
        createdAt: "2026-02-03T08:00:00.000Z",
        updatedAt: "2026-02-03T09:00:00.000Z",
        version: 1,
        cryptoVersion: 1,
        iv: "aXY=",
        wrappedKey: "d3JhcA==",
        ciphertext: "Y2lwaGVy",
      },
    ];
    const text = entriesToBackup([record], vault);
    expect(parseBackup(text)).toEqual({ entries: [record], vault });
  });

  it("reads older backups that only contain entries", () => {
    const text = JSON.stringify({
      kind: "encrypted-backup",
      entries: [record],
    });
    expect(parseBackup(text)).toEqual({ entries: [record], vault: [] });
  });

  it("rejects foreign JSON", () => {
    expect(() => parseBackup("{}")).toThrow();
    expect(() => parseBackup("not json")).toThrow();
  });
});

describe("orderEntries", () => {
  it("sorts newest journal date first", () => {
    const older = { ...entry, id: "old", date: "2026-01-01" };
    const newest = { ...entry, id: "new", date: "2026-03-01" };
    expect(orderEntries([older, newest]).map((e) => e.id)).toEqual(["new", "old"]);
  });
});
