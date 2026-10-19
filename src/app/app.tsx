"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, RotateCcw } from "lucide-react";
import * as api from "@/lib/api-client";
import { createSalts } from "@/lib/crypto";
import type { AccountParams } from "@/lib/types";
import { Brand } from "./brand";
import { Flame } from "./flame";
import { Journal } from "./journal";
import { RegisterServiceWorker } from "./register-sw";
import { SetupScreen } from "./setup-screen";
import { ThemeToggle } from "./theme-toggle";
import { UnlockScreen } from "./unlock-screen";
import { ghostButtonClass } from "./ui";

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
          setMessage(
            "The database is unreachable. Check your connection and try again.",
          );
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
        setMessage(
          err instanceof Error ? err.message : "Could not reach the server.",
        );
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
      <main className="relative flex min-h-dvh justify-center overflow-hidden px-5 py-6">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-28 -top-16 h-64 w-64 rounded-full bg-accent-lime/35 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent-lilac/25 blur-3xl" />
        </div>

        <div className="relative flex w-full max-w-md flex-col">
          <div className="flex items-center justify-between gap-3">
            <Brand />
            <ThemeToggle />
          </div>

          <div className="flex flex-1 items-center py-8">
            {phase === "loading" && (
              <div className="w-full text-center">
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] bg-accent-lime text-[#09090b]">
                  <Flame className="h-11 w-11" glow animated />
                </span>
                <p className="mt-5 text-sm font-semibold">Warming up…</p>
                <p className="mt-1 text-xs text-ash">
                  Checking this browser&apos;s encryption setup.
                </p>
              </div>
            )}

            {phase === "error" && (
              <div className="w-full rounded-[2rem] border border-smoke bg-paper p-6 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-300">
                  <CloudOff className="h-6 w-6" strokeWidth={2} aria-hidden />
                </span>
                <p className="mt-4 text-base font-semibold">
                  Something is out of reach
                </p>
                <p className="mt-2 text-sm text-ash">{message}</p>
                <button
                  type="button"
                  className={`${ghostButtonClass} mt-5 w-full`}
                  onClick={() => window.location.reload()}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Try again
                </button>
              </div>
            )}

            {phase === "setup" && params && (
              <SetupScreen params={params} onDone={unlock} />
            )}
            {phase === "locked" && params && (
              <UnlockScreen params={params} onUnlocked={unlock} />
            )}
          </div>

          <p className="text-center text-[0.58rem] font-medium uppercase tracking-[0.2em] text-ash">
            End-to-end encrypted · stays yours
          </p>
        </div>
      </main>
    </>
  );
}
