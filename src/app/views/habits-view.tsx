"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  CircleCheckBig,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { DecryptedHabit } from "@/lib/types";
import {
  HABIT_COLOR_KEYS,
  HABIT_ICON_KEYS,
  completionRate,
  habitStreak,
  isCompletedToday,
  lastDays,
  type HabitColorKey,
  type HabitIconKey,
} from "@/lib/habits";
import { plural } from "@/lib/format";
import { HABIT_COLOR_META, HABIT_ICON_META, HabitGlyph, habitColorMeta } from "../habit-meta";
import { HabitDetail } from "./habit-detail";
import { Sheet } from "../sheet";
import { inputClass, labelClass } from "../ui";
import { cn } from "../cn";

interface HabitInput {
  name: string;
  icon: HabitIconKey;
  color: HabitColorKey;
}

interface Props {
  habits: DecryptedHabit[];
  busyIds: Set<string>;
  onCreate: (input: HabitInput) => Promise<void>;
  onUpdate: (id: string, input: HabitInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string) => void;
}

const EMPTY_FORM: HabitInput = { name: "", icon: "flame", color: "lime" };

/** Habit tracker with independent streaks and a satisfying check animation. */
export function HabitsView({
  habits,
  busyIds,
  onCreate,
  onUpdate,
  onDelete,
  onToggle,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<DecryptedHabit | null>(null);
  const [form, setForm] = useState<HabitInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const activeHabit = openId
    ? habits.find((habit) => habit.id === openId) ?? null
    : null;

  const doneToday = habits.filter((habit) =>
    isCompletedToday(habit.completions),
  ).length;

  function openCalendar(id: string) {
    setOpenId(id);
    window.scrollTo({ top: 0 });
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setConfirmDelete(false);
    setError("");
    setSheetOpen(true);
  }

  function openEdit(habit: DecryptedHabit) {
    setEditing(habit);
    setForm({
      name: habit.name,
      icon: (HABIT_ICON_KEYS as readonly string[]).includes(habit.icon)
        ? (habit.icon as HabitIconKey)
        : "flame",
      color: (HABIT_COLOR_KEYS as readonly string[]).includes(habit.color)
        ? (habit.color as HabitColorKey)
        : "lime",
    });
    setConfirmDelete(false);
    setError("");
    setSheetOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) {
      setError("Give the habit a short name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) await onUpdate(editing.id, { ...form, name });
      else await onCreate({ ...form, name });
      setSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the habit.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onDelete(editing.id);
      setSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the habit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-view space-y-4">
      {activeHabit ? (
        <HabitDetail
          key={activeHabit.id}
          habit={activeHabit}
          onBack={() => setOpenId(null)}
          onEdit={() => openEdit(activeHabit)}
        />
      ) : (
        <>
          <header className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ash">
                Small things, every day
              </p>
              <h1 className="mt-1 text-[2rem] font-semibold leading-[1.05] tracking-[-0.045em]">
                Habits
              </h1>
              <p className="mt-1 text-sm text-ash">
                Each habit keeps its own little flame.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="tap grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-lg"
              aria-label="New habit"
            >
              <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden />
            </button>
          </header>

          <section className="flex items-center gap-4 rounded-[1.75rem] bg-ink p-5 text-paper">
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-paper/55">
                Today
              </p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[2.3rem] font-extrabold leading-none tracking-[-0.05em] tabular-nums">
                  {doneToday}
                </span>
                <span className="text-sm font-semibold text-paper/60">
                  of {habits.length} {plural(habits.length, "habit")}
                </span>
              </p>
              <p className="mt-2 text-xs text-paper/55">
                {habits.length === 0
                  ? "Add the first thing you want to repeat."
                  : doneToday === habits.length
                    ? "All done. The whole set is lit."
                    : "Tap a circle to check one off."}
              </p>
            </div>
            <ProgressRing done={doneToday} total={habits.length} />
          </section>

          {habits.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-smoke px-6 py-12 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-lime text-[#09090b]">
                <CircleCheckBig className="h-6 w-6" strokeWidth={2} aria-hidden />
              </span>
              <p className="mt-4 text-sm font-semibold">No habits yet.</p>
              <p className="mt-1 text-sm text-ash">
                Pick something small enough to do on a bad day.
              </p>
              <button
                type="button"
                onClick={openCreate}
                className="tap mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
              >
                <Plus className="h-4 w-4" aria-hidden /> Add a habit
              </button>
            </div>
          ) : (
            <ol className="stagger space-y-3">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  busy={busyIds.has(habit.id)}
                  onToggle={() => onToggle(habit.id)}
                  onEdit={() => openEdit(habit)}
                  onOpen={() => openCalendar(habit.id)}
                />
              ))}
            </ol>
          )}

          <p className="px-1 pb-2 text-center text-[0.66rem] leading-relaxed text-ash">
            An empty today does not break a streak until tomorrow.
          </p>
        </>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? "Edit habit" : "New habit"}
        description={
          editing
            ? "Rename it, swap the icon, or pick a new colour."
            : "Small, repeatable, yours."
        }
        footer={
          <div className="flex items-center gap-2">
            {editing && (
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className={cn(
                  "tap inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold",
                  confirmDelete
                    ? "bg-red-600 text-white"
                    : "border border-red-500/25 text-red-600 dark:text-red-300",
                )}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {confirmDelete ? "Tap again" : "Delete"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="tap ml-auto rounded-full border border-smoke px-4 py-2.5 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.name.trim()}
              className="tap rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-40"
            >
              {saving ? "Saving…" : editing ? "Save" : "Add habit"}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {error && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="habit-name">
              Name
            </label>
            <input
              id="habit-name"
              autoFocus
              className={inputClass}
              placeholder="e.g. Read ten pages"
              maxLength={60}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Icon</p>
            <div className="grid grid-cols-7 gap-1.5">
              {HABIT_ICON_KEYS.map((key) => {
                const meta = HABIT_ICON_META[key];
                const active = form.icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, icon: key }))}
                    aria-label={meta.label}
                    aria-pressed={active}
                    title={meta.label}
                    className={cn(
                      "tap grid aspect-square place-items-center rounded-xl border text-[#09090b]",
                      active
                        ? "border-[#09090b] bg-accent-lime"
                        : "border-smoke bg-paper text-ink hover:bg-mist",
                    )}
                  >
                    <meta.Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Colour</p>
            <div className="flex flex-wrap gap-2">
              {HABIT_COLOR_KEYS.map((key) => {
                const meta = HABIT_COLOR_META[key];
                const active = form.color === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, color: key }))}
                    aria-label={meta.label}
                    aria-pressed={active}
                    title={meta.label}
                    className={cn(
                      "tap grid h-9 w-9 place-items-center rounded-full text-[#09090b] ring-offset-2 ring-offset-paper",
                      meta.bg,
                      active && "ring-2 ring-ink",
                    )}
                  >
                    {active && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl p-4 text-[#09090b]",
              habitColorMeta(form.color).bg,
            )}
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#09090b]/10">
              <HabitGlyph name={form.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">{form.name.trim() || "Your habit"}</p>
              <p className="text-xs font-medium text-[#09090b]/55">
                Preview · 0 day streak
              </p>
            </div>
            <Sparkles className="ml-auto h-4 w-4 text-[#09090b]/40" aria-hidden />
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function HabitCard({
  habit,
  busy,
  onToggle,
  onEdit,
  onOpen,
}: {
  habit: DecryptedHabit;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onOpen: () => void;
}) {
  const color = habitColorMeta(habit.color);
  const streak = habitStreak(habit.completions);
  const doneToday = isCompletedToday(habit.completions);
  const week = useMemo(
    () => lastDays(7, habit.completions),
    [habit.completions],
  );
  const rate = completionRate(habit.completions, 7);

  return (
    <li
      className={cn(
        "rounded-[1.6rem] p-4 text-[#09090b] shadow-[0_12px_30px_-24px_rgba(0,0,0,0.5)]",
        color.bg,
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${habit.name} calendar`}
          className="tap flex min-w-0 flex-1 items-start gap-3 rounded-2xl text-left"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#09090b]/10">
            <HabitGlyph name={habit.icon} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.02rem] font-bold leading-tight tracking-[-0.02em]">
              {habit.name}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[0.68rem] font-semibold text-[#09090b]/60">
              <span className="inline-flex items-center gap-1">
                <span className="text-accent-orange">
                  <FlameGlyph />
                </span>
                {streak} {plural(streak, "day")} streak
              </span>
              <span aria-hidden>·</span>
              <span>{rate}/7 this week</span>
            </span>
          </span>
          <ChevronRight
            className="mt-2.5 h-4 w-4 shrink-0 text-[#09090b]/35"
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${habit.name}`}
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#09090b]/50 hover:bg-[#09090b]/10 hover:text-[#09090b]"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <div className="flex flex-1 items-end justify-between gap-1">
          {week.map((day) => (
            <span key={day.key} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[0.55rem] font-bold uppercase tracking-wide text-[#09090b]/45">
                {day.letter}
              </span>
              <span
                className={cn(
                  "grid h-7 w-full max-w-8 place-items-center rounded-lg text-[#09090b]",
                  day.done
                    ? "bg-[#09090b] text-accent-lime"
                    : "bg-[#09090b]/10",
                  day.isToday && !day.done && "ring-1 ring-[#09090b]/35",
                )}
                title={day.date.toLocaleDateString()}
              >
                {day.done && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
              </span>
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-label={
            doneToday ? `Undo today's ${habit.name}` : `Complete ${habit.name} today`
          }
          aria-pressed={doneToday}
          className={cn(
            "tap relative grid h-12 w-12 shrink-0 place-items-center rounded-full transition",
            doneToday
              ? "bg-[#09090b] text-accent-lime"
              : "border-2 border-[#09090b]/25 bg-white/35 text-[#09090b] hover:bg-white/60",
            busy && "opacity-60",
          )}
        >
          {doneToday && (
            <span
              key={habit.completions.length}
              aria-hidden
              className="animate-burst absolute inset-0 rounded-full border-2 border-[#09090b]/30"
            />
          )}
          {doneToday ? (
            <Check
              key={`check-${habit.completions.length}`}
              className="animate-check h-6 w-6"
              strokeWidth={3}
              aria-hidden
            />
          ) : (
            <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden />
          )}
        </button>
      </div>
    </li>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? done / total : 0;

  return (
    <div className="relative grid h-16 w-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="6"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#c9f75a"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute text-sm font-extrabold tabular-nums">
        {total > 0 ? Math.round(progress * 100) : 0}%
      </span>
    </div>
  );
}

function FlameGlyph() {
  // A tiny filled flame that reads at 11px, without pulling in the animated one.
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
      <path
        d="M12 1.8c.6 3.6 3.1 5.7 4.9 7.6A7.6 7.6 0 0 1 19.2 14.6a7.2 7.2 0 1 1-14.4 0c0-2.2 1-4.1 2.4-5.8C9.1 6.7 11.1 4.8 12 1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}
