"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";

const STORE_KEY = "gb-theme";
const EVENT = "gb-theme-change";

const LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const ORDER: Theme[] = ["light", "dark", "system"];

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readSnapshot(): Theme {
  const stored = localStorage.getItem(STORE_KEY);
  return isTheme(stored) ? stored : "system";
}

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** One compact round button that cycles light → dark → system. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    readSnapshot,
    () => "system" as Theme,
  );

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function change(next: Theme) {
    localStorage.setItem(STORE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event(EVENT));
  }

  function cycle() {
    const index = ORDER.indexOf(theme);
    change(ORDER[(index + 1) % ORDER.length]);
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${LABEL[theme]}. Tap to change.`}
      title={`Theme: ${LABEL[theme]}`}
      className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full border border-smoke bg-paper text-ink transition hover:bg-mist"
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  );
}
