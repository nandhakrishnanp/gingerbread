"use client";

import { BookOpen, CircleCheckBig, Plus, Sparkles, Wallet } from "lucide-react";
import { cn } from "../cn";

export type View = "journal" | "habits" | "streak" | "thoughts" | "expenses";

interface Props {
  view: View;
  onNavigate: (view: View) => void;
  onCompose: () => void;
}

/** Mobile-first tab bar with a raised compose button in the middle. */
export function BottomNav({ view, onNavigate, onCompose }: Props) {
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto w-full max-w-lg px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        <div className="rounded-[1.75rem] border border-smoke bg-paper/90 p-1.5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="grid grid-cols-5 items-center">
            <Tab
              label="Journal"
              active={view === "journal"}
              onClick={() => onNavigate("journal")}
            >
              <BookOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
            </Tab>

            <Tab
              label="Habits"
              active={view === "habits"}
              onClick={() => onNavigate("habits")}
            >
              <CircleCheckBig className="h-5 w-5" strokeWidth={2} aria-hidden />
            </Tab>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={onCompose}
                aria-label="Write a new entry"
                className="tap -mt-7 grid h-14 w-14 place-items-center rounded-full border-4 border-paper bg-accent-lime text-[#09090b] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)] transition hover:brightness-95"
              >
                <Plus className="h-6 w-6" strokeWidth={2.4} aria-hidden />
              </button>
            </div>

            <Tab
              label="Money"
              active={view === "expenses"}
              onClick={() => onNavigate("expenses")}
            >
              <Wallet className="h-5 w-5" strokeWidth={2} aria-hidden />
            </Tab>

            <Tab
              label="Thoughts"
              active={view === "thoughts"}
              onClick={() => onNavigate("thoughts")}
            >
              <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
            </Tab>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Tab({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tap flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5",
        active
          ? "bg-accent-lime text-[#09090b]"
          : "text-ash hover:bg-mist hover:text-ink",
      )}
    >
      {children}
      <span className="truncate text-[0.62rem] font-semibold tracking-wide">
        {label}
      </span>
    </button>
  );
}
