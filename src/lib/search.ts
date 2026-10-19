import MiniSearch from "minisearch";
import type { DecryptedEntry } from "./types";

export interface SearchIndex {
  search(query: string): string[];
}

/** Build an in-memory index over decrypted entries (PLAN.md §12). */
export function buildSearchIndex(entries: DecryptedEntry[]): SearchIndex {
  const index = new MiniSearch<{ id: string; title: string; markdown: string; tags: string }>({
    fields: ["title", "markdown", "tags"],
    storeFields: ["id"],
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2 } },
  });

  index.addAll(
    entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      markdown: entry.markdown,
      tags: entry.tags.join(" "),
    })),
  );

  return {
    search(query: string): string[] {
      const trimmed = query.trim();
      if (!trimmed) return [];
      return index.search(trimmed).map((result) => result.id as string);
    },
  };
}
