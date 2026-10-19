"use client";

import { useState } from "react";
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
  ghostButtonClass,
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
      <span className="text-4xl" aria-hidden>
        🍪
      </span>
      <h1 className="mt-3 font-serif text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm opacity-80">
        {mode === "password"
          ? "Enter your password to decrypt your journal."
          : "Enter your recovery key to regain access."}
      </p>

      {mode === "password" ? (
        <form onSubmit={handlePassword}>
          <label className="mt-6 block text-sm font-medium">
            Password
            <input
              className={`${inputClass} mt-1`}
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className={`${errorTextClass} mt-4`}>{error}</p>}
          <button type="submit" disabled={busy} className={`${primaryButtonClass} mt-6 w-full`}>
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRecovery}>
          <label className="mt-6 block text-sm font-medium">
            Recovery key
            <input
              className={`${inputClass} mt-1 font-mono`}
              type="text"
              spellCheck={false}
              autoComplete="off"
              placeholder="XXXX-XXXX-XXXX-…"
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
            />
          </label>
          {error && <p className={`${errorTextClass} mt-4`}>{error}</p>}
          <button type="submit" disabled={busy} className={`${primaryButtonClass} mt-6 w-full`}>
            {busy ? "Unlocking…" : "Unlock with recovery key"}
          </button>
        </form>
      )}

      <button
        type="button"
        className={`${ghostButtonClass} mt-5 w-full justify-center`}
        onClick={() => {
          setMode((m) => (m === "password" ? "recovery" : "password"));
          setError("");
        }}
      >
        {mode === "password"
          ? "Forgot password? Use recovery key"
          : "Back to password"}
      </button>
    </div>
  );
}
