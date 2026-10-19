"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const grouped = useMemo(() => {
    const groups = new Map<string, DecryptedEntry[]>();
    for (const entry of visible) {
      const list = groups.get(entry.date) ?? [];
      list.push(entry);
      groups.set(entry.date, list);
    }
    return [...groups.entries()];
  }, [visible]);

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

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={`${
          selectedId ? "hidden md:flex" : "flex"
        } w-full shrink-0 flex-col border-r border-cocoa/15 bg-sugar/60 md:w-80 dark:bg-bark/50`}
      >
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              🍪
            </span>
            <h1 className="font-serif text-xl font-semibold">Gingerbread</h1>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>

          <input
            className={inputClass}
            placeholder="Search entries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="flex gap-2">
            <button
              type="button"
              className={`${primaryButtonClass} flex-1`}
              onClick={createEntry}
              disabled={busy}
            >
              + New entry
            </button>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeTag && (
                <button
                  type="button"
                  className="rounded-full bg-ember px-2.5 py-1 text-xs text-cream"
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
                    className="rounded-full bg-ginger/15 px-2.5 py-1 text-xs hover:bg-ginger/25"
                    onClick={() => setActiveTag(tag)}
                  >
                    #{tag} {count}
                  </button>
                ))}
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {visible.length === 0 && (
            <p className="text-sm opacity-60">
              {entries.length === 0 ? "No entries yet. Start writing!" : "No matches."}
            </p>
          )}
          {grouped.map(([date, group]) => (
            <div key={date}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide opacity-50">
                {formatDate(date)}
              </p>
              <ul className="space-y-1">
                {group.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => selectEntry(entry)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition hover:bg-ginger/15 ${
                        entry.id === selectedId ? "bg-ginger/20" : ""
                      }`}
                    >
                      <span className="block truncate font-medium">
                        {entry.title.trim() || "(untitled)"}
                      </span>
                      <span className="block truncate text-xs opacity-60">
                        {entry.markdown.replace(/\s+/g, " ").slice(0, 70) || "…"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-cocoa/15 p-4 text-sm">
          <details className="rounded-lg border border-cocoa/15 px-3 py-2">
            <summary className="cursor-pointer font-medium">Export &amp; backup</summary>
            <div className="mt-2 flex flex-col gap-1.5">
              <button className={ghostButtonClass} type="button" onClick={() => void exportPdf(entries)}>
                Export PDF
              </button>
              <button className={ghostButtonClass} type="button" onClick={() => exportMarkdown(entries)}>
                Export Markdown
              </button>
              <button className={ghostButtonClass} type="button" onClick={() => exportEncryptedJson(records)}>
                Download encrypted backup
              </button>
              <button
                className={ghostButtonClass}
                type="button"
                onClick={() => fileInput.current?.click()}
              >
                Restore from backup…
              </button>
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
            </div>
          </details>
          <div className="flex gap-2">
            <button type="button" className={`${ghostButtonClass} flex-1 justify-center`} onClick={onLock}>
              Lock
            </button>
            <button
              type="button"
              className={`${ghostButtonClass} flex-1 justify-center`}
              onClick={() => void api.logout().then(onLogout)}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main
        className={`${
          selectedId ? "flex" : "hidden md:flex"
        } min-w-0 flex-1 flex-col overflow-y-auto bg-cream/40 p-4 sm:p-6 dark:bg-bark/30`}
      >
        {draft && selectedId ? (
          <>
            <button
              type="button"
              className={`${ghostButtonClass} mb-3 self-start md:hidden`}
              onClick={() => setSelectedId(null)}
            >
              ← All entries
            </button>
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
            />
          </>
        ) : (
          <div className="m-auto max-w-sm text-center opacity-70">
            <span className="text-5xl" aria-hidden>
              ✍️
            </span>
            <p className="mt-4">
              Select an entry, or create a new one to start writing. Everything is
              encrypting right here in your browser.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
