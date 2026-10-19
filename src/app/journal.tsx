"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Cookie,
  Download,
  FileText,
  Lock,
  LogOut,
  MoreHorizontal,
  Upload,
} from "lucide-react";
import * as api from "@/lib/api-client";
import {
  AUTOLOCK_IDLE_MS,
  AUTOSAVE_DEBOUNCE_MS,
  CRYPTO_VERSION,
} from "@/lib/constants";
import { decryptEntry, decryptValue, encryptEntry, encryptValue } from "@/lib/crypto";
import {
  exportEncryptedJson,
  exportMarkdown,
  exportPdf,
  orderEntries,
  parseBackup,
} from "@/lib/backup";
import { buildSearchIndex } from "@/lib/search";
import {
  currentStreak,
  dateKey,
  entryCountsByDate,
} from "@/lib/streaks";
import {
  normalizeCompletions,
  toggleCompletion,
  type HabitColorKey,
  type HabitIconKey,
} from "@/lib/habits";
import type {
  DecryptedEntry,
  DecryptedHabit,
  DecryptedThought,
  Draft,
  EntryPlain,
  EntryRecord,
  HabitPlain,
  ThoughtPlain,
  VaultRecord,
} from "@/lib/types";
import { EntryEditor, type HistoryItem, type SaveStatus } from "./entry-editor";
import { ThemeToggle } from "./theme-toggle";
import { BottomNav, type View } from "./views/bottom-nav";
import { JournalView } from "./views/journal-view";
import { StreakView } from "./views/streak-view";
import { HabitsView } from "./views/habits-view";
import { ThoughtsView } from "./views/thoughts-view";
import { Sheet } from "./sheet";
import { Flame } from "./flame";
import { iconButtonClass } from "./ui";
import { cn } from "./cn";

interface Props {
  masterKey: Uint8Array;
  onLock: () => void;
  onLogout: () => void;
}

const VIEW_TITLES: Record<View, string> = {
  journal: "Journal",
  habits: "Habits",
  streak: "Streak",
  thoughts: "Thoughts",
};

function isDirty(draft: Draft, saved: DecryptedEntry): boolean {
  return (
    draft.title !== saved.title ||
    draft.markdown !== saved.markdown ||
    draft.date !== saved.date ||
    draft.tags.length !== saved.tags.length ||
    draft.tags.some((tag, i) => tag !== saved.tags[i])
  );
}

function toDecrypted(record: EntryRecord, plain: EntryPlain): DecryptedEntry {
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

function toThought(record: VaultRecord, plain: ThoughtPlain): DecryptedThought {
  return {
    id: record.id,
    text: plain.text,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    version: record.version,
    cryptoVersion: record.cryptoVersion,
  };
}

function toHabit(record: VaultRecord, plain: HabitPlain): DecryptedHabit {
  return {
    id: record.id,
    name: plain.name,
    icon: plain.icon,
    color: plain.color,
    completions: normalizeCompletions(plain.completions),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    version: record.version,
    cryptoVersion: record.cryptoVersion,
  };
}

function viewFromHash(): View {
  if (typeof window === "undefined") return "journal";
  const value = window.location.hash.replace(/^#\/?/, "");
  return value === "habits" || value === "streak" || value === "thoughts"
    ? value
    : "journal";
}

export function Journal({ masterKey, onLock, onLogout }: Props) {
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [records, setRecords] = useState<EntryRecord[]>([]);
  const [vault, setVault] = useState<VaultRecord[]>([]);
  const [thoughts, setThoughts] = useState<DecryptedThought[]>([]);
  const [habits, setHabits] = useState<DecryptedHabit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");

  const [view, setView] = useState<View>("journal");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [habitBusy, setHabitBusy] = useState<Set<string>>(new Set());

  const entriesRef = useRef(entries);
  const draftRef = useRef(draft);
  const selectedIdRef = useRef(selectedId);
  const savingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => void (entriesRef.current = entries), [entries]);
  useEffect(() => void (draftRef.current = draft), [draft]);
  useEffect(() => void (selectedIdRef.current = selectedId), [selectedId]);

  useEffect(() => {
    const sync = () => setView(viewFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = useCallback((next: View) => {
    setView(next);
    const nextHash = `#/${next}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const load = useCallback(async () => {
    const [recs, vaultRecords] = await Promise.all([
      api.fetchEntries(),
      api.fetchVaultRecords().catch((err) => {
        console.warn("[journal] vault unavailable", err);
        return [] as VaultRecord[];
      }),
    ]);

    const decrypted: DecryptedEntry[] = [];
    for (const record of recs) {
      try {
        const plain = await decryptEntry(masterKey, record.id, record.version, record);
        decrypted.push(toDecrypted(record, plain));
      } catch {
        console.warn("[journal] skipping unreadable entry", record.id);
      }
    }

    const nextThoughts: DecryptedThought[] = [];
    const nextHabits: DecryptedHabit[] = [];
    for (const record of vaultRecords) {
      try {
        if (record.kind === "thought") {
          const plain = await decryptValue<ThoughtPlain>(
            masterKey,
            record.id,
            record.version,
            record,
          );
          if (plain && typeof plain.text === "string") {
            nextThoughts.push(toThought(record, plain));
          }
        } else {
          const plain = await decryptValue<HabitPlain>(
            masterKey,
            record.id,
            record.version,
            record,
          );
          nextHabits.push(
            toHabit(record, {
              name:
                plain && typeof plain.name === "string"
                  ? plain.name
                  : "Untitled habit",
              icon:
                plain && typeof plain.icon === "string" ? plain.icon : "flame",
              color:
                plain && typeof plain.color === "string" ? plain.color : "lime",
              completions: normalizeCompletions(plain?.completions),
            }),
          );
        }
      } catch {
        console.warn("[journal] skipping unreadable vault item", record.id);
      }
    }

    nextThoughts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    nextHabits.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    setRecords(recs);
    setEntries(decrypted);
    setVault(vaultRecords);
    setThoughts(nextThoughts);
    setHabits(nextHabits);
  }, [masterKey]);

  useEffect(() => {
    let active = true;
    // Initial fetch on mount: the state updates land after the async load
    // resolves, not synchronously during this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .catch((err) =>
        active
          ? setLoadError(
              err instanceof Error ? err.message : "Failed to load your journal",
            )
          : undefined,
      )
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
    window.addEventListener("pagehide", onLock);
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
      window.removeEventListener("pagehide", onLock);
    };
  }, [onLock]);

  const streak = useMemo(
    () => currentStreak(entryCountsByDate(entries)),
    [entries],
  );

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
    if (dayFilter) list = list.filter((entry) => entry.date === dayFilter);
    return orderEntries(list);
  }, [entries, query, activeTag, dayFilter, index]);

  const selectEntry = useCallback((entry: DecryptedEntry) => {
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
  }, []);

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

  const createEntry = useCallback(async () => {
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const date = dayFilter ?? dateKey(new Date());
      const plain: EntryPlain = { title: "", markdown: "", tags: [] };
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
      setView("journal");
      window.history.replaceState(null, "", "#/journal");
      selectEntry(decrypted);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not start a new entry.");
    } finally {
      setBusy(false);
    }
  }, [masterKey, dayFilter, selectEntry]);

  async function deleteEntry(id: string) {
    try {
      await api.deleteEntryRecord(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      setRecords((prev) => prev.filter((record) => record.id !== id));
      if (selectedIdRef.current === id) {
        setSelectedId(null);
        setDraft(null);
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete the entry.");
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

  // -------------------------------------------------------------------------
  // Thoughts
  // -------------------------------------------------------------------------

  const createThought = useCallback(
    async (text: string) => {
      const id = crypto.randomUUID();
      const plain: ThoughtPlain = { text };
      const blob = await encryptValue(masterKey, id, 0, plain);
      const record = await api.createVaultRecord({
        id,
        kind: "thought",
        version: 0,
        cryptoVersion: CRYPTO_VERSION,
        ...blob,
      });
      setVault((prev) => [record, ...prev]);
      setThoughts((prev) => [toThought(record, plain), ...prev]);
    },
    [masterKey],
  );

  const updateThought = useCallback(
    async (id: string, text: string) => {
      const thought = thoughts.find((item) => item.id === id);
      if (!thought) return;
      const version = thought.version + 1;
      const plain: ThoughtPlain = { text };
      const blob = await encryptValue(masterKey, id, version, plain);
      const record = await api.updateVaultRecord(id, {
        version,
        cryptoVersion: CRYPTO_VERSION,
        ...blob,
      });
      setVault((prev) => prev.map((item) => (item.id === id ? record : item)));
      setThoughts((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                text,
                version: record.version,
                updatedAt: record.updatedAt,
              }
            : item,
        ),
      );
    },
    [masterKey, thoughts],
  );

  const deleteThought = useCallback(async (id: string) => {
    await api.deleteVaultRecord(id);
    setVault((prev) => prev.filter((item) => item.id !== id));
    setThoughts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // -------------------------------------------------------------------------
  // Habits
  // -------------------------------------------------------------------------

  const markHabitBusy = useCallback((id: string, value: boolean) => {
    setHabitBusy((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const createHabit = useCallback(
    async (input: {
      name: string;
      icon: HabitIconKey;
      color: HabitColorKey;
    }) => {
      const id = crypto.randomUUID();
      const plain: HabitPlain = { ...input, completions: [] };
      const blob = await encryptValue(masterKey, id, 0, plain);
      const record = await api.createVaultRecord({
        id,
        kind: "habit",
        version: 0,
        cryptoVersion: CRYPTO_VERSION,
        ...blob,
      });
      setVault((prev) => [...prev, record]);
      setHabits((prev) => [...prev, toHabit(record, plain)]);
    },
    [masterKey],
  );

  const updateHabit = useCallback(
    async (
      id: string,
      input: { name: string; icon: HabitIconKey; color: HabitColorKey },
    ) => {
      const habit = habits.find((item) => item.id === id);
      if (!habit) return;
      const version = habit.version + 1;
      const plain: HabitPlain = { ...input, completions: habit.completions };
      const blob = await encryptValue(masterKey, id, version, plain);
      const record = await api.updateVaultRecord(id, {
        version,
        cryptoVersion: CRYPTO_VERSION,
        ...blob,
      });
      setVault((prev) => prev.map((item) => (item.id === id ? record : item)));
      setHabits((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...input,
                version: record.version,
                updatedAt: record.updatedAt,
              }
            : item,
        ),
      );
    },
    [masterKey, habits],
  );

  const deleteHabit = useCallback(async (id: string) => {
    await api.deleteVaultRecord(id);
    setVault((prev) => prev.filter((item) => item.id !== id));
    setHabits((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleHabit = useCallback(
    async (id: string) => {
      const habit = habits.find((item) => item.id === id);
      if (!habit || habitBusy.has(id)) return;
      const completions = toggleCompletion(habit.completions);
      const optimistic: DecryptedHabit = { ...habit, completions };

      setHabits((prev) => prev.map((item) => (item.id === id ? optimistic : item)));
      markHabitBusy(id, true);
      try {
        const version = habit.version + 1;
        const plain: HabitPlain = {
          name: habit.name,
          icon: habit.icon,
          color: habit.color,
          completions,
        };
        const blob = await encryptValue(masterKey, id, version, plain);
        const record = await api.updateVaultRecord(id, {
          version,
          cryptoVersion: CRYPTO_VERSION,
          ...blob,
        });
        setVault((prev) => prev.map((item) => (item.id === id ? record : item)));
        setHabits((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  version: record.version,
                  updatedAt: record.updatedAt,
                }
              : item,
          ),
        );
      } catch (err) {
        setHabits((prev) =>
          prev.map((item) => (item.id === id ? habit : item)),
        );
        setToast(
          err instanceof Error ? err.message : "Could not save the check-in.",
        );
      } finally {
        markHabitBusy(id, false);
      }
    },
    [habits, habitBusy, markHabitBusy, masterKey],
  );

  // -------------------------------------------------------------------------
  // Backup + export
  // -------------------------------------------------------------------------

  async function restoreBackup(text: string) {
    setBusy(true);
    try {
      const contents = parseBackup(text);
      let restored = 0;
      let failed = 0;
      for (const record of contents.entries) {
        try {
          await api.createEntryRecord(record);
          restored += 1;
        } catch {
          failed += 1;
        }
      }
      for (const record of contents.vault) {
        try {
          await api.createVaultRecord(record);
          restored += 1;
        } catch {
          failed += 1;
        }
      }
      await load();
      const total = contents.entries.length + contents.vault.length;
      setToast(
        failed > 0
          ? `Restored ${restored} of ${total} items. ${failed} were skipped (already present).`
          : `Restored ${restored} ${restored === 1 ? "item" : "items"}.`,
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] bg-accent-lime text-[#09090b]">
            <Flame className="h-11 w-11" glow animated />
          </span>
          <p className="mt-5 text-sm font-semibold">Unlocking your thread…</p>
          <p className="mt-1 text-xs text-ash">
            Decrypting everything in this browser.
          </p>
        </div>
      </div>
    );
  }

  const latestThought = thoughts[0] ?? null;

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-smoke/70 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2 px-4 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-paper">
            <Cookie className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-ash">
              Gingerbread
            </p>
            <p className="truncate text-sm font-semibold tracking-tight">
              {VIEW_TITLES[view]}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate("streak")}
              aria-label={`${streak} day streak — open the streak page`}
              className="tap inline-flex h-10 items-center gap-1.5 rounded-full border border-smoke bg-paper pl-2 pr-3 text-sm font-bold"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-lime text-[#09090b]">
                <Flame className="h-4 w-4" animated />
              </span>
              <span className="tabular-nums">{streak}</span>
            </button>
            <ThemeToggle />
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
              className={iconButtonClass}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pb-32 pt-4">
        {loadError && (
          <p className="mb-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {loadError}
          </p>
        )}

        {view === "journal" && (
          <JournalView
            entries={entries}
            visible={visible}
            allTags={allTags}
            query={query}
            onQueryChange={setQuery}
            activeTag={activeTag}
            onTagChange={setActiveTag}
            dayFilter={dayFilter}
            onDayFilter={setDayFilter}
            streak={streak}
            busy={busy}
            onCreate={createEntry}
            onSelect={selectEntry}
            onOpenStreak={() => navigate("streak")}
            thoughtsCount={thoughts.length}
            latestThought={latestThought}
            onOpenThoughts={() => navigate("thoughts")}
          />
        )}

        {view === "streak" && (
          <StreakView
            entries={entries}
            onWrite={() => {
              navigate("journal");
              void createEntry();
            }}
          />
        )}

        {view === "habits" && (
          <HabitsView
            habits={habits}
            busyIds={habitBusy}
            onCreate={createHabit}
            onUpdate={updateHabit}
            onDelete={deleteHabit}
            onToggle={(id) => void toggleHabit(id)}
          />
        )}

        {view === "thoughts" && (
          <ThoughtsView
            thoughts={thoughts}
            busy={busy}
            onCreate={createThought}
            onUpdate={updateThought}
            onDelete={deleteThought}
          />
        )}
      </main>

      <BottomNav view={view} onNavigate={navigate} onCompose={createEntry} />

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void file.text().then(restoreBackup);
        }}
      />

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu"
        description="Your data stays encrypted in this browser."
      >
        <div className="space-y-1">
          <MenuRow
            icon={<FileText className="h-4 w-4" aria-hidden />}
            label="Export PDF"
            hint="A readable keepsake"
            onClick={() => {
              setMenuOpen(false);
              void exportPdf(entries);
            }}
          />
          <MenuRow
            icon={<Download className="h-4 w-4" aria-hidden />}
            label="Export Markdown"
            hint="Plain text, all entries"
            onClick={() => {
              setMenuOpen(false);
              exportMarkdown(entries);
            }}
          />
          <MenuRow
            icon={<Lock className="h-4 w-4" aria-hidden />}
            label="Encrypted backup"
            hint="Ciphertext only — includes habits & thoughts"
            onClick={() => {
              setMenuOpen(false);
              exportEncryptedJson(records, vault);
            }}
          />
          <MenuRow
            icon={<Upload className="h-4 w-4" aria-hidden />}
            label="Restore backup"
            hint="Merge an encrypted JSON backup"
            onClick={() => {
              setMenuOpen(false);
              fileInput.current?.click();
            }}
          />
        </div>

        <div className="my-3 border-t border-smoke" />

        <div className="space-y-1">
          <MenuRow
            icon={<Lock className="h-4 w-4" aria-hidden />}
            label="Lock now"
            hint="Drop the key from memory"
            onClick={() => {
              setMenuOpen(false);
              onLock();
            }}
          />
          <MenuRow
            icon={<LogOut className="h-4 w-4" aria-hidden />}
            label="Sign out"
            hint="End this session"
            danger
            onClick={() => {
              setMenuOpen(false);
              void api.logout().then(onLogout);
            }}
          />
        </div>
      </Sheet>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <p className="animate-rise max-w-md rounded-full bg-ink px-4 py-2.5 text-center text-xs font-medium text-paper shadow-xl">
            {toast}
          </p>
        </div>
      )}

      {selectedId && draft && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={closeEditor}
          role="presentation"
        >
          <div
            className="h-dvh w-full overflow-y-auto bg-paper p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-[2rem] sm:border sm:border-smoke sm:p-6"
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

function MenuRow({
  icon,
  label,
  hint,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-mist",
        danger && "text-red-600 dark:text-red-300",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mist",
          danger && "bg-red-500/10",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-[0.68rem] text-ash">{hint}</span>
      </span>
    </button>
  );
}
