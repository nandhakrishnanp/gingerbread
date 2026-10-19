"use client";

import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { DecryptedEntry, DecryptedThought } from "@/lib/types";
import { addDays, dateKey, startOfDay } from "@/lib/streaks";
import { formatLongDate, formatShortDate, greeting, plural } from "@/lib/format";
import { Flame } from "../flame";
import { inputClass } from "../ui";
import { cn } from "../cn";

interface Props {
  entries: DecryptedEntry[];
  visible: DecryptedEntry[];
  allTags: Array<[string, number]>;
  query: string;
  onQueryChange: (value: string) => void;
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
  dayFilter: string | null;
  onDayFilter: (day: string | null) => void;
  streak: number;
  busy: boolean;
  onCreate: () => void;
  onSelect: (entry: DecryptedEntry) => void;
  onOpenStreak: () => void;
  thoughtsCount: number;
  latestThought: DecryptedThought | null;
  onOpenThoughts: () => void;
}

const ACCENT_CHIPS = [
  "bg-accent-lime",
  "bg-accent-sky",
  "bg-accent-pink",
  "bg-accent-butter",
  "bg-accent-lilac",
  "bg-accent-mint",
  "bg-accent-orange",
];

function accentFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENT_CHIPS[hash % ACCENT_CHIPS.length];
}

/** The journal stream: greeting, week strip, streak teaser and entries. */
export function JournalView({
  entries,
  visible,
  allTags,
  query,
  onQueryChange,
  activeTag,
  onTagChange,
  dayFilter,
  onDayFilter,
  streak,
  busy,
  onCreate,
  onSelect,
  onOpenStreak,
  thoughtsCount,
  latestThought,
  onOpenThoughts,
}: Props) {
  const today = startOfDay(new Date());
  const todayKey = dateKey(today);
  const monday = addDays(today, today.getDay() === 0 ? -6 : 1 - today.getDay());
  const week = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
  }

  const hasFilters = query.trim().length > 0 || activeTag !== null || dayFilter !== null;

  return (
    <div className="animate-view space-y-5">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ash">
            {formatLongDate()}
          </p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-[1.05] tracking-[-0.045em]">
            {greeting()}
          </h1>
          <p className="mt-1 text-sm text-ash">
            One line is enough to keep the thread alive.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenStreak}
          aria-label={`${streak} day streak — open streaks`}
          className="tap group relative grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] border border-smoke bg-paper"
        >
          <Flame className="h-9 w-9 text-ink" glow={streak > 0} />
          <span className="absolute -bottom-1.5 -right-1.5 grid min-w-6 place-items-center rounded-full bg-accent-lime px-1.5 py-0.5 text-[0.68rem] font-extrabold text-[#09090b]">
            {streak}
          </span>
        </button>
      </header>

      <section aria-label="This week" className="flex gap-1.5">
        {week.map((day) => {
          const key = dateKey(day);
          const isToday = key === todayKey;
          const isFuture = day.getTime() > today.getTime();
          const selected = dayFilter === key;
          const count = counts.get(key) ?? 0;
          return (
            <button
              key={key}
              type="button"
              disabled={isFuture}
              onClick={() => onDayFilter(selected ? null : key)}
              aria-pressed={selected}
              aria-label={`${day.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}, ${count} ${plural(count, "entry")}`}
              className={cn(
                "tap flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 disabled:opacity-35",
                isToday
                  ? "bg-ink text-paper"
                  : selected
                    ? "bg-accent-lime text-[#09090b]"
                    : "border border-smoke bg-paper text-ink hover:bg-mist",
              )}
            >
              <span className="text-[0.58rem] font-semibold uppercase tracking-wider opacity-60">
                {day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}
              </span>
              <span className="text-sm font-bold tabular-nums">{day.getDate()}</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  count > 0
                    ? isToday
                      ? "bg-accent-lime"
                      : "bg-accent-green"
                    : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </section>

      <button
        type="button"
        onClick={onOpenStreak}
        className="tap group relative block w-full overflow-hidden rounded-[1.75rem] bg-accent-lime p-5 text-left text-[#09090b]"
      >
        <span
          aria-hidden
          className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[14px] border-[#09090b]/10"
        />
        <span
          aria-hidden
          className="absolute -bottom-12 right-16 h-24 w-24 rounded-full bg-[#09090b]/5"
        />
        <div className="relative flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#09090b]">
            <Flame className="h-9 w-9 text-accent-lime" glow animated />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#09090b]/60">
              Current streak
            </span>
            <span className="mt-0.5 flex items-baseline gap-1.5">
              <span
                key={streak}
                className="animate-pop text-[2.25rem] font-extrabold leading-none tracking-[-0.05em] tabular-nums"
              >
                {streak}
              </span>
              <span className="text-sm font-semibold text-[#09090b]/70">
                {plural(streak, "day")}
              </span>
            </span>
            <span className="mt-1 block text-xs font-medium text-[#09090b]/60">
              Tap to open your green grid
            </span>
          </span>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#09090b]/10 transition group-hover:translate-x-0.5">
            <ChevronRight className="h-5 w-5" />
          </span>
        </div>
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={busy}
          className="tap flex min-w-0 flex-1 items-center gap-3 rounded-[1.4rem] border border-smoke bg-paper p-3.5 text-left hover:bg-mist"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-lilac text-[#09090b]">
            <Pencil className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              What&rsquo;s on your mind?
            </span>
            <span className="block text-xs text-ash">Start a new entry</span>
          </span>
          <Plus className="h-5 w-5 shrink-0 text-ash" aria-hidden />
        </button>
      </div>

      {entries.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ash"
              aria-hidden
            />
            <input
              className={cn(inputClass, "rounded-full py-2.5 pl-11 text-sm")}
              placeholder="Search your thread…"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>

          {allTags.length > 0 && (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
              {activeTag && (
                <button
                  type="button"
                  className="tap inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-paper"
                  onClick={() => onTagChange(null)}
                >
                  #{activeTag}
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
              {allTags
                .filter(([tag]) => tag !== activeTag)
                .map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    className="tap shrink-0 rounded-full border border-smoke bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-mist"
                    onClick={() => onTagChange(tag)}
                  >
                    #{tag}
                    <span className="ml-1 text-ash">{count}</span>
                  </button>
                ))}
            </div>
          )}

          {dayFilter && (
            <div className="flex items-center gap-2 text-xs text-ash">
              <span>Showing {formatShortDate(dayFilter)}</span>
              <button
                type="button"
                onClick={() => onDayFilter(null)}
                className="inline-flex items-center gap-1 rounded-full border border-smoke px-2 py-1 font-medium text-ink hover:bg-mist"
              >
                Clear <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}

      {thoughtsCount > 0 && latestThought && (
        <button
          type="button"
          onClick={onOpenThoughts}
          className="tap flex w-full items-start gap-3 rounded-[1.4rem] border border-dashed border-smoke bg-mist/60 p-4 text-left hover:bg-mist"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-butter text-[#09090b]">
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ash">
              Latest thought
              <span className="rounded-full bg-paper px-1.5 py-0.5 normal-case tracking-normal">
                {thoughtsCount}
              </span>
            </span>
            <span className="mt-1 line-clamp-2 block text-sm leading-snug text-ink">
              {latestThought.text}
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-ash" aria-hidden />
        </button>
      )}

      {visible.length === 0 ? (
        <EmptyState
          empty={entries.length === 0}
          filtered={hasFilters}
          busy={busy}
          onCreate={onCreate}
        />
      ) : (
        <ol className="stagger space-y-2.5">
          {visible.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className="tap block w-full rounded-[1.4rem] border border-smoke bg-paper p-4 text-left hover:bg-mist/50"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-[#09090b]",
                      accentFor(entry.id),
                    )}
                  >
                    {formatShortDate(entry.date)}
                  </span>
                  {entry.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[0.68rem] text-ash">
                      #{tag}
                    </span>
                  ))}
                  <ChevronRight className="ml-auto h-4 w-4 text-ash" aria-hidden />
                </div>

                {entry.title.trim() && (
                  <h2 className="mt-2 text-[1.05rem] font-semibold leading-snug tracking-[-0.02em]">
                    {entry.title}
                  </h2>
                )}
                {entry.markdown.trim() && (
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
                    {entry.markdown.trim()}
                  </p>
                )}
                {!entry.title.trim() && !entry.markdown.trim() && (
                  <p className="mt-2 text-sm italic text-ash">Empty entry</p>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EmptyState({
  empty,
  filtered,
  busy,
  onCreate,
}: {
  empty: boolean;
  filtered: boolean;
  busy: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-smoke px-6 py-12 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-lime text-[#09090b]">
        {empty ? (
          <BookOpen className="h-6 w-6" strokeWidth={2} aria-hidden />
        ) : (
          <Search className="h-6 w-6" strokeWidth={2} aria-hidden />
        )}
      </span>
      <p className="mt-4 text-sm font-semibold">
        {empty ? "Your thread is empty." : "No entries match."}
      </p>
      <p className="mt-1 text-sm text-ash">
        {empty
          ? "Write the first line — it only has to be one."
          : "Try a different search, tag or day."}
      </p>
      {empty && (
        <button
          type="button"
          onClick={onCreate}
          disabled={busy}
          className="tap mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
        >
          <Plus className="h-4 w-4" aria-hidden /> Write the first entry
        </button>
      )}
      {filtered && !empty && (
        <p className="mt-3 text-[0.68rem] uppercase tracking-[0.14em] text-ash">
          Filters are on
        </p>
      )}
    </div>
  );
}
