"use client";

import { Cookie } from "lucide-react";
import { cn } from "./cn";

/** Small wordmark used on the auth screens. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-ink text-paper">
        <Cookie className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        <span
          aria-hidden
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-lime"
        />
      </span>
      <span className="leading-tight">
        <span className="block text-[0.58rem] font-bold uppercase tracking-[0.24em] text-ash">
          Private journal
        </span>
        <span className="block text-lg font-semibold tracking-[-0.04em]">
          gingerbread
        </span>
      </span>
    </div>
  );
}
