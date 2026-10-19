"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const STORE_KEY = "gb-theme";
const EVENT = "gb-theme-change";

const LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};
const ICON: Record<Theme, string> = { light: "☀️", dark: "🌙", system: "🍪" };

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

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readSnapshot, () => "system" as Theme);

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

  return (
    <button
      type="button"
      onClick={() =>
        change(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-cocoa/20 px-3 py-1.5 text-sm hover:bg-ginger/10"
      title={`Theme: ${LABEL[theme]} (click to change)`}
    >
      <span aria-hidden>{ICON[theme]}</span>
      <span className="hidden sm:inline">{LABEL[theme]}</span>
    </button>
  );
}
