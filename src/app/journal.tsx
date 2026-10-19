"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as api from "@/lib/api-client";
import { AUTOLOCK_IDLE_MS, AUTOSAVE_DEBOUNCE_MS, CRYPTO_VERSION } from "@/lib/constants";
import { decryptEntry, encryptEntry } from "@/lib/crypto";
import {
  exportEncryptedJson,
  exportMarkdown,
  exportPdf,
  orderEntries,
  parseBackup,
} from "@/lib/backup";
import { buildSearchIndex } from "@/lib/search";
import type { DecryptedEntry, Draft, EntryRecord } from "@/lib/types";
import { ActivityHeatmap } from "./activity-heatmap";
import { EntryEditor, type HistoryItem, type SaveStatus } from "./entry-editor";
import { ThemeToggle } from "./theme-toggle";
import { ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

interface Props {
  masterKey: Uint8Array;
  onLock: () => void;
  onLogout: () => void;
}

function isDirty(draft: Draft, saved: DecryptedEntry): boolean {
  return (
    draft.title !== saved.title ||
    draft.markdown !== saved.markdown ||
    draft.date !== saved.date ||
    draft.tags.length !== saved.tags.length ||
    draft.tags.some((tag, i) => tag !== saved.tags[i])
  );
}

function toDecrypted(record: EntryRecord, plain: { title: string; markdown: string; tags: string[] }): DecryptedEntry {
  return {
    ...plain,
    id: record.id,
    date: record.date,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    version: record.version,
    cryptoVersion: record.cryptoVersion,
  };
}

export function Journal({ masterKey, onLock, onLogout }: Props) {
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [records, setRecords] = useState<EntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const entriesRef = useRef(entries);
  const draftRef = useRef(draft);
  const selectedIdRef = useRef(selectedId);
  const savingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => void (entriesRef.current = entries), [entries]);
  useEffect(() => void (draftRef.current = draft), [draft]);
  useEffect(() => void (selectedIdRef.current = selectedId), [selectedId]);

  const load = useCallback(async () => {
    const recs = await api.fetchEntries();
    const decrypted: DecryptedEntry[] = [];
    for (const record of recs) {
      try {
        const plain = await decryptEntry(masterKey, record.id, record.version, record);
        decrypted.push(toDecrypted(record, plain));
      } catch {
        console.warn("[journal] skipping unreadable entry", record.id);
      }
    }
    setRecords(recs);
    setEntries(decrypted);
  }, [masterKey]);

  useEffect(() => {
    let active = true;
    // Initial fetch on mount: the state updates land after the async load
    // resolves, not synchronously during this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .catch((err) => active && setLoadError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load]);

  // Auto-lock after a period of inactivity.
  useEffect(() => {
    let timer = 0;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onLock, AUTOLOCK_IDLE_MS);
    };
    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    // Lock when the tab is hidden for good (close/back-forward cache).
    window.addEventListener("pagehide", onLock);
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
      window.removeEventListener("pagehide", onLock);
    };
  }, [onLock]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const index = useMemo(() => buildSearchIndex(entries), [entries]);

  const visible = useMemo(() => {
    let list = entries;
    if (query.trim()) {
      const ids = new Set(index.search(query));
      list = list.filter((entry) => ids.has(entry.id));
    }
    if (activeTag) list = list.filter((entry) => entry.tags.includes(activeTag));
    return orderEntries(list);
  }, [entries, query, activeTag, index]);

  const selectEntry = useCallback(
    (entry: DecryptedEntry) => {
      setSelectedId(entry.id);
      setDraft({
        title: entry.title,
        markdown: entry.markdown,
        tags: [...entry.tags],
        date: entry.date,
      });
      setStatus("saved");
      setHistoryOpen(false);
      setHistory([]);
    },
    [],
  );

  const save = useCallback(async () => {
    const id = selectedIdRef.current;
    const current = draftRef.current;
    if (!id || !current || savingRef.current) return;
    const saved = entriesRef.current.find((entry) => entry.id === id);
    if (!saved || !isDirty(current, saved)) {
      setStatus("saved");
      return;
    }

    savingRef.current = true;
    setStatus("saving");
    try {
      const version = saved.version + 1;
      const blob = await encryptEntry(masterKey, id, version, {
        title: current.title,
        markdown: current.markdown,
        tags: current.tags,
      });
      const record = await api.updateEntryRecord(id, {
        version,
        date: current.date,
        cryptoVersion: CRYPTO_VERSION,
        ...blob,
      });
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? { ...toDecrypted(record, current), createdAt: saved.createdAt }
            : entry,
        ),
      );
      setRecords((prev) => prev.map((r) => (r.id === id ? record : r)));
      setStatus("saved");
    } catch (err) {
      if (err instanceof api.ApiError && err.status === 409) {
        setStatus("dirty");
        await load();
      } else {
        setStatus("error");
      }
    } finally {
      savingRef.current = false;
    }
  }, [masterKey, load]);

  // Debounced autosave whenever the draft diverges from what is stored.
  useEffect(() => {
    if (!draft || !selectedId) return;
    const saved = entries.find((entry) => entry.id === selectedId);
    if (!saved || !isDirty(draft, saved)) return;
    const timer = window.setTimeout(() => void save(), AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, selectedId, entries, save]);

  /** Close the compose overlay, flushing any pending edit first. */
  const closeEditor = useCallback(() => {
    void save().finally(() => setSelectedId(null));
  }, [save]);

  // Escape closes the compose overlay.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, closeEditor]);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    if (!selectedId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selectedId]);

  async function createEntry() {
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const date = new Date().toISOString().slice(0, 10);
      const plain = { title: "", markdown: "", tags: [] };
      const blob = await encryptEntry(masterKey, id, 0, plain);
      const record = await api.createEntryRecord({
        id,
        date,
        version: 0,
        cryptoVersion: CRYPTO_VERSION,
        ...blob,
      });
      const decrypted = toDecrypted(record, plain);
      setRecords((prev) => [record, ...prev]);
      setEntries((prev) => [decrypted, ...prev]);
      selectEntry(decrypted);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    await api.deleteEntryRecord(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    setRecords((prev) => prev.filter((record) => record.id !== id));
    if (selectedIdRef.current === id) {
      setSelectedId(null);
      setDraft(null);
    }
  }

  async function toggleHistory() {
    const id = selectedIdRef.current;
    if (!id) return;
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const revisions = await api.fetchRevisions(id);
      const items: HistoryItem[] = [];
      for (const revision of revisions) {
        try {
          const plain = await decryptEntry(masterKey, revision.id, revision.version, revision);
          items.push({
            version: revision.version,
            createdAt: revision.updatedAt,
            preview: (plain.title || plain.markdown).slice(0, 80),
            plain,
          });
        } catch {
          /* skip unreadable revision */
        }
      }
      setHistory(items);
    } finally {
      setHistoryLoading(false);
    }
  }

  function restoreHistory(item: HistoryItem) {
    setDraft((prev) => (prev ? { ...prev, ...item.plain } : prev));
    setHistoryOpen(false);
  }

  async function restoreBackup(text: string) {
    setBusy(true);
    try {
      const recordsToRestore = parseBackup(text);
      let restored = 0;
      let failed = 0;
      for (const record of recordsToRestore) {
        try {
          await api.createEntryRecord(record);
          restored += 1;
        } catch {
          failed += 1;
        }
      }
      await load();
      if (failed > 0) {
        alert(
          `Restored ${restored} of ${recordsToRestore.length} entries. ` +
            `${failed} were skipped (already present).`,
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center text-lg opacity-70">
        Unlocking your journal…
      </div>
    );
  }

  const hasFilters = query.trim().length > 0 || activeTag !== null;

  return (
    <div className="min-h-dvh bg-cream text-bark dark:bg-bark dark:text-cream">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-cream/85 backdrop-blur-md dark:border-white/15 dark:bg-bark/85">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/15 text-lg dark:border-white/20"
          >
            🍪
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate font-serif text-lg font-semibold tracking-tight">
              Gingerbread
            </h1>
            <p className="hidden text-xs opacity-50 sm:block">your private thread</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className={`${primaryButtonClass} px-3 sm:px-4`}
              onClick={createEntry}
              disabled={busy}
            >
              + New
            </button>
            <ThemeToggle />
            <div className="relative">
              <button
                type="button"
                aria-label="Menu"
                className={`${ghostButtonClass} px-2.5`}
                onClick={() => setMenuOpen((open) => !open)}
              >
                ⋯
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    className="fixed inset-0 z-30 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-black/10 bg-white p-1.5 shadow-xl dark:border-white/15 dark:bg-neutral-950">
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        void exportPdf(entries);
                      }}
                    >
                      Export PDF
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        exportMarkdown(entries);
                      }}
                    >
                      Export Markdown
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        exportEncryptedJson(records);
                      }}
                    >
                      Encrypted backup
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        fileInput.current?.click();
                      }}
                    >
                      Restore from backup…
                    </MenuItem>
                    <div className="my-1 border-t border-black/10 dark:border-white/15" />
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        onLock();
                      }}
                    >
                      Lock
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        void api.logout().then(onLogout);
                      }}
                    >
                      Sign out
                    </MenuItem>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl space-y-2 px-4 pb-3">
          <input
            className={inputClass}
            placeholder="Search the thread…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeTag && (
                <button
                  type="button"
                  className="rounded-full bg-black px-2.5 py-1 text-xs text-white dark:bg-white dark:text-black"
                  onClick={() => setActiveTag(null)}
                >
                  #{activeTag} ×
                </button>
              )}
              {allTags
                .filter(([tag]) => tag !== activeTag)
                .map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    className="rounded-full border border-black/15 px-2.5 py-1 text-xs transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                    onClick={() => setActiveTag(tag)}
                  >
                    #{tag} {count}
                  </button>
                ))}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16">
        {loadError && (
          <p className="py-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>
        )}

        {!hasFilters && entries.length > 0 && (
          <>
            <ActivityHeatmap entries={entries} />
            <button
              type="button"
              onClick={createEntry}
              disabled={busy}
              className="flex w-full items-center gap-3 border-b border-black/10 py-4 text-left text-lg opacity-60 transition hover:bg-black/[0.02] dark:border-white/15 dark:hover:bg-white/[0.03]"
            >
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/15 text-xs font-semibold dark:border-white/20"
              >
                You
              </span>
              <span>What&rsquo;s on your mind?</span>
            </button>
          </>
        )}

        {visible.length === 0 ? (
          <div className="py-24 text-center opacity-60">
            <p className="text-5xl" aria-hidden>
              {entries.length === 0 ? "🍪" : "🔍"}
            </p>
            <p className="mt-4 text-sm">
              {entries.length === 0
                ? "Your thread is empty. Start writing."
                : "No posts match your filters."}
            </p>
            {entries.length === 0 && (
              <button
                type="button"
                className={`${primaryButtonClass} mt-5`}
                onClick={createEntry}
                disabled={busy}
              >
                + New entry
              </button>
            )}
          </div>
        ) : (
          <ol>
            {visible.map((entry, index) => (
              <li key={entry.id} className="flex gap-3">
                <div className="flex w-10 shrink-0 flex-col items-center">
                  <Avatar entry={entry} />
                  {index < visible.length - 1 && (
                    <span
                      aria-hidden
                      className="w-px flex-1 bg-black/10 dark:bg-white/15"
                    />
                  )}
                </div>
                <article
                  className={`min-w-0 flex-1 ${
                    index < visible.length - 1 ? "pb-6" : "pb-4"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectEntry(entry)}
                    className="-mx-2 block w-full rounded-xl px-2 py-1.5 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                      <span className="font-semibold">Gingerbread</span>
                      <span className="opacity-50">@you</span>
                      <span className="opacity-40">
                        · {formatPostDate(entry.date)}
                      </span>
                    </div>
                    {entry.title.trim() && (
                      <h2 className="mt-0.5 font-serif text-xl font-semibold leading-snug">
                        {entry.title}
                      </h2>
                    )}
                    {entry.markdown.trim() && (
                      <p className="mt-0.5 line-clamp-6 whitespace-pre-wrap text-[0.95rem] leading-relaxed opacity-90">
                        {entry.markdown.trim()}
                      </p>
                    )}
                    {entry.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-2 text-sm opacity-60">
                        {entry.tags.map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </button>
                </article>
              </li>
            ))}
          </ol>
        )}
      </main>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void file.text().then(restoreBackup);
        }}
      />

      {selectedId && draft && (
        <div
          className="fixed inset-0 z-50 flex justify-center bg-black/50 backdrop-blur-sm sm:p-6"
          onClick={closeEditor}
        >
          <div
            className="w-full max-w-2xl overflow-y-auto bg-cream p-4 shadow-2xl sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-black/10 sm:p-6 dark:bg-neutral-950 sm:dark:border-white/15"
            onClick={(event) => event.stopPropagation()}
          >
            <EntryEditor
              draft={draft}
              status={status}
              onPatch={(patch) =>
                setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
              }
              onFlush={() => void save()}
              onDelete={() => void deleteEntry(selectedId)}
              historyOpen={historyOpen}
              history={history}
              historyLoading={historyLoading}
              onToggleHistory={() => void toggleHistory()}
              onRestore={restoreHistory}
              onClose={closeEditor}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ entry }: { entry: DecryptedEntry }) {
  const initial =
    (entry.title.trim() || entry.tags[0] || "").slice(0, 1).toUpperCase() || "·";
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/15 bg-dough text-sm font-semibold uppercase dark:border-white/20 dark:bg-white/10"
    >
      {initial}
    </span>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function formatPostDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
