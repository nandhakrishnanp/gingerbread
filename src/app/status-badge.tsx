"use client";

import { useEffect, useState } from "react";

interface Status {
  app: string;
  dbOk: boolean;
  configured: boolean;
  authenticated: boolean;
}

export function StatusBadge() {
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/status", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad status"))))
      .then((data: Status) => setStatus(data))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  let label: string;
  let tone: string;

  if (failed) {
    label = "Could not reach the server";
    tone = "bg-red-500/10 text-red-700 dark:text-red-300";
  } else if (!status) {
    label = "Checking…";
    tone = "bg-black/5 dark:bg-white/10";
  } else if (!status.dbOk) {
    label = "Database unreachable";
    tone = "bg-red-500/10 text-red-700 dark:text-red-300";
  } else if (!status.configured) {
    label = "Ready — no account yet";
    tone = "bg-ginger/20 text-ember";
  } else if (status.authenticated) {
    label = "Signed in";
    tone = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  } else {
    label = "Account exists — please sign in";
    tone = "bg-ginger/20 text-ember";
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${tone}`}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
