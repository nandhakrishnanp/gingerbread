/** Shared Tailwind class strings so the black-and-white thread look stays consistent. */

export const inputClass =
  "w-full rounded-2xl border border-smoke bg-mist px-4 py-3 text-base text-ink outline-none transition placeholder:text-ash focus:border-ink focus:bg-paper focus:ring-4 focus:ring-ink/5";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

export const accentButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent-lime px-5 py-3 text-sm font-semibold text-[#09090b] transition hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

export const ghostButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-smoke bg-paper px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-mist active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

export const iconButtonClass =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-smoke bg-paper text-ink transition hover:bg-mist active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

export const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-red-500/30 bg-paper px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 active:scale-[0.98] dark:text-red-300";

export const cardClass =
  "w-full max-w-md rounded-[2rem] border border-smoke bg-paper p-6 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.35)] sm:p-8";

export const errorTextClass =
  "rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300";

export const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-smoke bg-paper px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-mist";

export const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ash";
