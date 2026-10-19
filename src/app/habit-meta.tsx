import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Brain,
  Code,
  Coffee,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Music,
  Pencil,
  Sun,
} from "lucide-react";
import {
  isHabitColor,
  isHabitIcon,
  type HabitColorKey,
  type HabitIconKey,
} from "@/lib/habits";

export const HABIT_ICON_META: Record<
  HabitIconKey,
  { label: string; Icon: LucideIcon }
> = {
  flame: { label: "Streak", Icon: Flame },
  book: { label: "Read", Icon: BookOpen },
  droplet: { label: "Water", Icon: Droplet },
  dumbbell: { label: "Train", Icon: Dumbbell },
  heart: { label: "Health", Icon: Heart },
  leaf: { label: "Nature", Icon: Leaf },
  music: { label: "Music", Icon: Music },
  coffee: { label: "Coffee", Icon: Coffee },
  brain: { label: "Focus", Icon: Brain },
  footprints: { label: "Walk", Icon: Footprints },
  pencil: { label: "Write", Icon: Pencil },
  sun: { label: "Morning", Icon: Sun },
  moon: { label: "Sleep", Icon: Moon },
  code: { label: "Code", Icon: Code },
};

export const HABIT_COLOR_META: Record<
  HabitColorKey,
  { label: string; bg: string; hex: string }
> = {
  lime: { label: "Lime", bg: "bg-accent-lime", hex: "#c9f75a" },
  butter: { label: "Butter", bg: "bg-accent-butter", hex: "#ffd86b" },
  pink: { label: "Bubblegum", bg: "bg-accent-pink", hex: "#ff9ec7" },
  sky: { label: "Sky", bg: "bg-accent-sky", hex: "#9ad4ff" },
  orange: { label: "Tangerine", bg: "bg-accent-orange", hex: "#ffab73" },
  lilac: { label: "Lilac", bg: "bg-accent-lilac", hex: "#c9b8ff" },
  mint: { label: "Mint", bg: "bg-accent-mint", hex: "#9df1c7" },
};

/** Render a habit's chosen icon (falls back to the flame for old data). */
export function HabitGlyph({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const Icon = HABIT_ICON_META[isHabitIcon(name) ? name : "flame"].Icon;
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}

export function habitColorMeta(name: string) {
  return HABIT_COLOR_META[isHabitColor(name) ? name : "lime"];
}
