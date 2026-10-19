"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import { createSalts } from "@/lib/crypto";
import type { AccountParams } from "@/lib/types";
import { Journal } from "./journal";
import { RegisterServiceWorker } from "./register-sw";
import { SetupScreen } from "./setup-screen";
import { ThemeToggle } from "./theme-toggle";
import { UnlockScreen } from "./unlock-screen";

type Phase = "loading" | "error" | "setup" | "locked" | "unlocked";

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [params, setParams] = useState<AccountParams | null>(null);
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.getAuthParams(), api.getAuthStatus()])
      .then(([authParams, status]) => {
        if (!active) return;
        if (!status.dbOk) {
          setMessage("The database is unreachable. Check your connection and try again.");
          setPhase("error");
          return;
        }
        if (
          !authParams.configured ||
          !authParams.saltAuth ||
          !authParams.saltEnc
        ) {
          // kdf is a placeholder here: setup probes the environment itself.
          setParams({ ...createSalts(), kdf: "argon2id" });
          setPhase("setup");
        } else {
          setParams({
            saltAuth: authParams.saltAuth,
            saltEnc: authParams.saltEnc,
            kdf: authParams.kdf ?? "argon2id",
          });
          setPhase("locked");
        }
      })
      .catch((err) => {
        if (!active) return;
        setMessage(err instanceof Error ? err.message : "Could not reach the server.");
        setPhase("error");
      });
    return () => {
      active = false;
    };
  }, []);

  /** Drop the master key from memory and return to the unlock screen. */
  const lock = useCallback(() => {
    setMasterKey((key) => {
      key?.fill(0);
      return null;
    });
    setPhase("locked");
  }, []);

  const unlock = useCallback((key: Uint8Array) => {
    setMasterKey(key);
    setPhase("unlocked");
  }, []);

  if (phase === "unlocked" && masterKey) {
    return (
      <>
        <RegisterServiceWorker />
        <Journal masterKey={masterKey} onLock={lock} onLogout={lock} />
      </>
    );
  }

  return (
    <>
      <RegisterServiceWorker />
      <main className="relative mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-6">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        {phase === "loading" && <p className="text-lg opacity-70">Loading…</p>}
        {phase === "error" && (
          <div className="text-center">
            <p className="text-lg">{message}</p>
            <button
              type="button"
              className="mt-4 rounded-lg bg-ember px-4 py-2 text-cream"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        )}
        {phase === "setup" && params && (
          <SetupScreen params={params} onDone={unlock} />
        )}
        {phase === "locked" && params && (
          <UnlockScreen params={params} onUnlocked={unlock} />
        )}
      </main>
    </>
  );
}
