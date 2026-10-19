"use client";

import { useState } from "react";
import { setupAccount } from "@/lib/api-client";
import { CRYPTO_VERSION } from "@/lib/constants";
import {
  bytesToBase64,
  createRecoveryKey,
  deriveKeys,
  formatRecoveryKey,
  recoveryProof,
  wrapMasterKeyWithRecovery,
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
  onDone: (masterKey: Uint8Array) => void;
}

/**
 * One-time account creation. Derives both keys locally, wraps the master key
 * with a fresh recovery key, and shows that recovery key exactly once.
 */
export function SetupScreen({ params, onDone }: Props) {
  const [step, setStep] = useState<"form" | "recovery">("form");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const keys = await deriveKeys(password, params.saltAuth, params.saltEnc);
      const recovery = createRecoveryKey();
      const [wrappedMasterKey, proof] = await Promise.all([
        wrapMasterKeyWithRecovery(recovery, keys.masterKey),
        recoveryProof(recovery),
      ]);

      await setupAccount({
        saltAuth: params.saltAuth,
        saltEnc: params.saltEnc,
        authKey: bytesToBase64(keys.authKey),
        kdf: keys.kdf,
        recoveryWrappedMasterKey: wrappedMasterKey,
        recoveryProof: proof,
        cryptoVersion: CRYPTO_VERSION,
      });

      setRecoveryKey(formatRecoveryKey(recovery));
      setMasterKey(keys.masterKey);
      setStep("recovery");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  if (step === "recovery") {
    return (
      <div className={cardClass}>
        <h1 className="font-serif text-3xl font-semibold">Your recovery key</h1>
        <p className="mt-3 text-pretty text-sm opacity-80">
          This is the only way back in if you forget your password. Write it down
          and store it somewhere safe. It is shown{" "}
          <strong>once and never again</strong>.
        </p>
        <p className="mt-5 break-words rounded-lg bg-ginger/15 px-4 py-3 font-mono text-lg tracking-wider text-ember">
          {recoveryKey}
        </p>
        <button
          type="button"
          className={`${ghostButtonClass} mt-3`}
          onClick={async () => {
            await navigator.clipboard.writeText(recoveryKey);
            setCopied(true);
          }}
        >
          {copied ? "Copied ✓" : "Copy to clipboard"}
        </button>

        <label className="mt-6 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>I have saved my recovery key somewhere safe.</span>
        </label>

        <button
          type="button"
          disabled={!acknowledged || !masterKey}
          className={`${primaryButtonClass} mt-6 w-full`}
          onClick={() => masterKey && onDone(masterKey)}
        >
          Enter my journal
        </button>
      </div>
    );
  }

  return (
    <form className={cardClass} onSubmit={handleSubmit}>
      <span className="text-4xl" aria-hidden>
        🍪
      </span>
      <h1 className="mt-3 font-serif text-3xl font-semibold">
        Create your journal
      </h1>
      <p className="mt-2 text-sm opacity-80">
        Choose a password. It encrypts everything in your browser — we can never
        read it, and no one can reset it.
      </p>

      <label className="mt-6 block text-sm font-medium">
        Password
        <input
          className={`${inputClass} mt-1`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Confirm password
        <input
          className={`${inputClass} mt-1`}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>

      {error && <p className={`${errorTextClass} mt-4`}>{error}</p>}

      <button type="submit" disabled={busy} className={`${primaryButtonClass} mt-6 w-full`}>
        {busy ? "Scrambling…" : "Create journal"}
      </button>
    </form>
  );
}
