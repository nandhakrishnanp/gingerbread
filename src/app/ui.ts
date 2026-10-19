/** Shared Tailwind class strings so the monochrome thread look stays consistent. */

export const inputClass =
  "w-full rounded-xl border border-black/15 bg-transparent px-3 py-2 text-base text-bark outline-none transition placeholder:opacity-50 focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/20 dark:text-cream dark:focus:border-white dark:focus:ring-white/15";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-black px-4 py-2 font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200";

export const ghostButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-black/15 px-3 py-1.5 text-sm transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";

export const dangerButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-red-500/40 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-500/10 dark:text-red-300";

export const cardClass =
  "w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/15 dark:bg-neutral-950";

export const errorTextClass =
  "rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300";
