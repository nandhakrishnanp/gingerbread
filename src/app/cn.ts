/** Tiny class-name joiner (no dependency, no tailwind-merge semantics needed). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
