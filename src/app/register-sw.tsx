"use client";

import { useEffect } from "react";

/** Registers the offline-shell service worker (production only). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.warn("[pwa] service worker registration failed", err));
  }, []);

  return null;
}
