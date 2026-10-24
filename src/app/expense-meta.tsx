import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Briefcase,
  Car,
  CircleEllipsis,
  CreditCard,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  ReceiptText,
  ShoppingBag,
  Smartphone,
  Utensils,
} from "lucide-react";
import type { ExpenseKind, PaymentMethod } from "@/lib/types";

export interface CategoryMeta {
  label: string;
  Icon: LucideIcon;
  /** Solid accent used by charts and dots. */
  hex: string;
  /** Tailwind class for icon tiles and chips. */
  bg: string;
}

const EXPENSE_META: Record<string, CategoryMeta> = {
  food: { label: "Food", Icon: Utensils, hex: "#ffab73", bg: "bg-accent-orange" },
  transport: { label: "Transport", Icon: Car, hex: "#9ad4ff", bg: "bg-accent-sky" },
  bills: { label: "Bills", Icon: ReceiptText, hex: "#ffd86b", bg: "bg-accent-butter" },
  shopping: { label: "Shopping", Icon: ShoppingBag, hex: "#ff9ec7", bg: "bg-accent-pink" },
  health: { label: "Health", Icon: HeartPulse, hex: "#9df1c7", bg: "bg-accent-mint" },
  fun: { label: "Fun", Icon: Gamepad2, hex: "#c9b8ff", bg: "bg-accent-lilac" },
  home: { label: "Home", Icon: House, hex: "#c9f75a", bg: "bg-accent-lime" },
  education: {
    label: "Education",
    Icon: GraduationCap,
    hex: "#7fd12f",
    bg: "bg-accent-green",
  },
  other: {
    label: "Other",
    Icon: CircleEllipsis,
    hex: "#a1a1aa",
    bg: "bg-smoke",
  },
};

const INCOME_META: Record<string, CategoryMeta> = {
  salary: { label: "Salary", Icon: Banknote, hex: "#c9f75a", bg: "bg-accent-lime" },
  freelance: { label: "Freelance", Icon: Laptop, hex: "#9ad4ff", bg: "bg-accent-sky" },
  business: { label: "Business", Icon: Briefcase, hex: "#ffd86b", bg: "bg-accent-butter" },
  gift: { label: "Gift", Icon: Gift, hex: "#ff9ec7", bg: "bg-accent-pink" },
  other: {
    label: "Other",
    Icon: CircleEllipsis,
    hex: "#a1a1aa",
    bg: "bg-smoke",
  },
};

export function categoryMeta(category: string, kind: ExpenseKind): CategoryMeta {
  const map = kind === "income" ? INCOME_META : EXPENSE_META;
  return map[category] ?? map.other;
}

export const PAYMENT_META: Record<
  PaymentMethod,
  { label: string; Icon: LucideIcon; hex: string }
> = {
  cash: { label: "Cash", Icon: Banknote, hex: "#ffd86b" },
  upi: { label: "UPI", Icon: Smartphone, hex: "#9ad4ff" },
  card: { label: "Card", Icon: CreditCard, hex: "#c9b8ff" },
  bank: { label: "Bank", Icon: Landmark, hex: "#9df1c7" },
  other: { label: "Other", Icon: CircleEllipsis, hex: "#a1a1aa" },
};
