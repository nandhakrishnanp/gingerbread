"use client";

import { useState } from "react";
import {
  Check,
  Clock3,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { DecryptedThought } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { accentButtonClass, inputClass } from "../ui";
import { cn } from "../cn";

interface Props {
  thoughts: DecryptedThought[];
  busy: boolean;
  onCreate: (text: string) => Promise<void>;
  onUpdate: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ACCENTS = [
  "bg-accent-butter",
  "bg-accent-sky",
  "bg-accent-pink",
  "bg-accent-lilac",
  "bg-accent-mint",
  "bg-accent-orange",
  "bg-accent-lime",
];

function accentFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length];
}

/** Quick capture for random thoughts, saved encrypted like everything else. */
export function ThoughtsView({
  thoughts,
  busy,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function save() {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(text);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that thought.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(thought: DecryptedThought) {
    setEditingId(thought.id);
    setEditText(thought.text);
    setConfirmingId(null);
    setError("");
  }

  async function saveEdit() {
    if (!editingId) return;
    const text = editText.trim();
    if (!text) return;
    setSaving(true);
    setError("");
    try {
      await onUpdate(editingId, text);
      setEditingId(null);
      setEditText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that thought.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onDelete(id);
      setConfirmingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that thought.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-view space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ash">
            Loose ends, kept safe
          </p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-[1.05] tracking-[-0.045em]">
            Thoughts
          </h1>
          <p className="mt-1 text-sm text-ash">
            Half-formed is perfectly fine.
          </p>
        </div>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-butter text-[#09090b]">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </span>
      </header>

      <section className="rounded-[1.6rem] border border-smoke bg-paper p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-lime text-[#09090b]">
            <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="thought-draft"
              className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ash"
            >
              Capture a thought
            </label>
            <textarea
              id="thought-draft"
              className={cn(
                inputClass,
                "mt-1.5 min-h-24 resize-none rounded-2xl bg-mist/70 text-[0.95rem] leading-relaxed",
              )}
              placeholder="A line you don't want to lose…"
              maxLength={2000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void save();
                }
              }}
            />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[0.62rem] text-ash">
                {draft.length > 0 ? `${draft.length}/2000` : "Ctrl / ⌘ + Enter to save"}
              </span>
              <button
                type="button"
                onClick={save}
                disabled={saving || busy || !draft.trim()}
                className={cn(accentButtonClass, "ml-auto px-4 py-2 text-xs")}
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                {saving ? "Saving…" : "Save thought"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}

      {thoughts.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-smoke px-6 py-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-butter text-[#09090b]">
            <Sparkles className="h-6 w-6" strokeWidth={2} aria-hidden />
          </span>
          <p className="mt-4 text-sm font-semibold">Nothing floating around yet.</p>
          <p className="mt-1 text-sm text-ash">
            Save the next odd idea that visits you.
          </p>
        </div>
      ) : (
        <ol className="stagger space-y-2.5">
          {thoughts.map((thought) => {
            const editing = editingId === thought.id;
            const confirming = confirmingId === thought.id;
            return (
              <li
                key={thought.id}
                className={cn(
                  "relative overflow-hidden rounded-[1.4rem] border border-smoke bg-paper p-4 pl-5",
                  editing && "ring-1 ring-ink/10",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 w-1.5",
                    accentFor(thought.id),
                  )}
                />

                {editing ? (
                  <div>
                    <textarea
                      className={cn(
                        inputClass,
                        "min-h-24 resize-none bg-mist/70 text-sm leading-relaxed",
                      )}
                      value={editText}
                      maxLength={2000}
                      autoFocus
                      onChange={(event) => setEditText(event.target.value)}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                          event.preventDefault();
                          void saveEdit();
                        }
                      }}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="tap ml-auto inline-flex items-center gap-1 rounded-full border border-smoke px-3 py-1.5 text-xs font-medium"
                      >
                        <X className="h-3 w-3" aria-hidden /> Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={saving || busy || !editText.trim()}
                        className="tap inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper disabled:opacity-40"
                      >
                        <Check className="h-3 w-3" aria-hidden /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink">
                      {thought.text}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[0.62rem] font-medium text-ash">
                        <Clock3 className="h-3 w-3" aria-hidden />
                        {relativeTime(thought.createdAt)}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(thought)}
                          aria-label="Edit thought"
                          className="tap grid h-8 w-8 place-items-center rounded-full text-ash hover:bg-mist hover:text-ink"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(thought.id)}
                          disabled={saving || busy}
                          aria-label={
                            confirming ? "Confirm delete thought" : "Delete thought"
                          }
                          className={cn(
                            "tap grid h-8 place-items-center rounded-full text-xs font-semibold",
                            confirming
                              ? "w-auto gap-1 bg-red-600 px-2.5 text-white"
                              : "w-8 text-ash hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300",
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          {confirming && "Sure?"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
