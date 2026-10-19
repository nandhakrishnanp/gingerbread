"use client";

import { useState } from "react";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { login, recover } from "@/lib/api-client";
import {
  bytesToBase64,
  deriveKeys,
  parseRecoveryKey,
  recoveryProof,
  unwrapMasterKeyWithRecovery,
} from "@/lib/crypto";
import type { AccountParams } from "@/lib/types";
import {
  cardClass,
  errorTextClass,
  inputClass,
  primaryButtonClass,
} from "./ui";

interface Props {
  params: AccountParams;
  onUnlocked: (masterKey: Uint8Array) => void;
}

/**
 * Unlock screen. Either derives the master key from the password (and verifies
 * the auth key with the server), or unwraps it with the recovery key.
 */
export function UnlockScreen({ params, onUnlocked }: Props) {
  const [mode, setMode] = useState<"password" | "recovery">("password");
  const [password, setPassword] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handlePassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { authKey, masterKey } = await deriveKeys(
        password,
        params.saltAuth,
        params.saltEnc,
        params.kdf,
      );
      await login(bytesToBase64(authKey));
      onUnlocked(masterKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecovery(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const recoveryKey = parseRecoveryKey(recoveryInput);
      const proof = await recoveryProof(recoveryKey);
      const wrapped = await recover(proof);
      const masterKey = await unwrapMasterKeyWithRecovery(recoveryKey, wrapped);
      onUnlocked(masterKey);
    } catch {
      setError("That recovery key did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cardClass}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-lime text-[#09090b]">
        <LockKeyhole className="h-6 w-6" strokeWidth={2} aria-hidden />
      </span>
      <h1 className="mt-4 text-[1.9rem] font-semibold leading-tight tracking-[-0.04em]">
        Welcome back
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ash">
        {mode === "password"
          ? "Enter your password. Everything is decrypted in this browser."
          : "Enter the recovery key you saved when you set up the journal."}
      </p>

      <div
        className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-smoke bg-mist/70 p-1"
        role="tablist"
        aria-label="Unlock method"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "password"}
          onClick={() => {
            setMode("password");
            setError("");
          }}
          className={
            mode === "password"
              ? "tap rounded-full bg-paper px-3 py-2 text-xs font-semibold shadow-sm"
              : "tap rounded-full px-3 py-2 text-xs font-medium text-ash"
          }
        >
          Password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "recovery"}
          onClick={() => {
            setMode("recovery");
            setError("");
          }}
          className={
            mode === "recovery"
              ? "tap rounded-full bg-paper px-3 py-2 text-xs font-semibold shadow-sm"
              : "tap rounded-full px-3 py-2 text-xs font-medium text-ash"
          }
        >
          Recovery key
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePassword}>
          <label className="mt-5 block text-sm font-medium" htmlFor="password">
            Password
            <input
              id="password"
              className={`${inputClass} mt-1.5`}
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className={`${errorTextClass} mt-4`}>{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className={`${primaryButtonClass} mt-5 w-full`}
          >
            {busy ? "Unlocking…" : "Unlock journal"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRecovery}>
          <label
            className="mt-5 block text-sm font-medium"
            htmlFor="recovery-key"
          >
            Recovery key
            <span className="mt-1.5 flex items-center gap-2">
              <KeyRound className="h-4 w-4 shrink-0 text-ash" aria-hidden />
              <input
                id="recovery-key"
                className={`${inputClass} font-mono text-sm tracking-wider`}
                type="text"
                spellCheck={false}
                autoComplete="off"
                placeholder="XXXX-XXXX-XXXX-…"
                value={recoveryInput}
                onChange={(event) => setRecoveryInput(event.target.value)}
              />
            </span>
          </label>
          {error && <p className={`${errorTextClass} mt-4`}>{error}</p>}
          <button
            type="submit"
            disabled={busy || !recoveryInput.trim()}
            className={`${primaryButtonClass} mt-5 w-full`}
          >
            {busy ? "Unlocking…" : "Unlock with recovery key"}
          </button>
        </form>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-[0.66rem] text-ash">
        <ShieldCheck className="h-3 w-3" aria-hidden />
        Your key never leaves this device.
      </p>
    </div>
  );
}
