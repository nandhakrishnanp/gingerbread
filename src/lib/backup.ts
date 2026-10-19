import type { DecryptedEntry, EntryRecord, VaultRecord } from "./types";

// ---------------------------------------------------------------------------
// Pure builders (unit-testable, no DOM)
// ---------------------------------------------------------------------------

/** Turn markdown into readable plain text for PDF rendering. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```[^\n]*\n?/g, "").trim(),
    )
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Build a single Markdown document for all entries. */
export function entriesToMarkdown(entries: DecryptedEntry[]): string {
  const ordered = orderEntries(entries);
  return ordered
    .map((entry) => {
      const title = entry.title.trim() || "(untitled)";
      const tags = entry.tags.length ? `\n*Tags: ${entry.tags.join(", ")}*` : "";
      return `# ${title}\n\n_${entry.date}_${tags}\n\n${entry.markdown.trim()}\n\n---\n`;
    })
    .join("\n");
}

export interface BackupContents {
  entries: EntryRecord[];
  vault: VaultRecord[];
}

/**
 * Serialise ciphertext records into an encrypted JSON backup document.
 * `vault` holds thoughts and habits; older backups simply omit it.
 */
export function entriesToBackup(
  records: EntryRecord[],
  vault: VaultRecord[] = [],
): string {
  return JSON.stringify(
    {
      app: "gingerbread",
      kind: "encrypted-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      count: records.length + vault.length,
      entries: records,
      vault,
    },
    null,
    2,
  );
}

/** Validate and extract records from a backup document. */
export function parseBackup(text: string): BackupContents {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not a valid JSON backup file");
  }
  const doc = parsed as { kind?: string; entries?: unknown; vault?: unknown };
  if (doc.kind !== "encrypted-backup" || !Array.isArray(doc.entries)) {
    throw new Error("Not a Gingerbread encrypted backup");
  }
  return {
    entries: doc.entries as EntryRecord[],
    vault: Array.isArray(doc.vault) ? (doc.vault as VaultRecord[]) : [],
  };
}

/** Newest first, by journal date then last update. */
export function orderEntries(entries: DecryptedEntry[]): DecryptedEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
}

// ---------------------------------------------------------------------------
// Browser download helpers
// ---------------------------------------------------------------------------

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, text: string, type: string): void {
  downloadBlob(filename, new Blob([text], { type }));
}

export function exportMarkdown(entries: DecryptedEntry[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadText(
    `gingerbread-journal-${stamp}.md`,
    entriesToMarkdown(entries),
    "text/markdown;charset=utf-8",
  );
}

export function exportEncryptedJson(
  records: EntryRecord[],
  vault: VaultRecord[] = [],
): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadText(
    `gingerbread-backup-${stamp}.json`,
    entriesToBackup(records, vault),
    "application/json",
  );
}

/** Render all entries to a PDF, entirely in the browser. */
export async function exportPdf(entries: DecryptedEntry[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const write = (
    text: string,
    options: { size: number; style: "normal" | "bold"; gap: number; color: [number, number, number] },
  ) => {
    doc.setFont("helvetica", options.style);
    doc.setFontSize(options.size);
    doc.setTextColor(...options.color);
    for (const line of doc.splitTextToSize(text, maxWidth) as string[]) {
      ensureSpace(options.size * 1.4);
      doc.text(line, margin, y);
      y += options.size * 1.4;
    }
    y += options.gap;
  };

  for (const [index, entry] of orderEntries(entries).entries()) {
    if (index > 0) {
      ensureSpace(40);
      y += 18;
    }
    write(entry.title.trim() || "(untitled)", {
      size: 20,
      style: "bold",
      gap: 4,
      color: [91, 58, 36],
    });
    write(
      entry.tags.length ? `${entry.date}  ·  ${entry.tags.join(", ")}` : entry.date,
      { size: 10, style: "normal", gap: 10, color: [163, 90, 31] },
    );
    write(stripMarkdown(entry.markdown) || "(empty)", {
      size: 12,
      style: "normal",
      gap: 0,
      color: [43, 27, 17],
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`gingerbread-journal-${stamp}.pdf`);
}
