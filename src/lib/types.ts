import type { Kdf } from "./constants";

/** Plaintext entry content. This never leaves the browser unencrypted. */
export interface EntryPlain {
  title: string;
  markdown: string;
  tags: string[];
}

/** The ciphertext envelope stored on the server for one entry version. */
export interface EncryptedBlob {
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

/** A decrypted entry with its opaque server metadata attached. */
export interface DecryptedEntry extends EntryPlain {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  cryptoVersion: number;
}

/** An entry as returned by the API (ciphertext only). */
export interface EntryRecord extends EncryptedBlob {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  cryptoVersion: number;
}

/** The public account parameters needed to unlock: both salts and the KDF. */
export interface AccountParams {
  saltAuth: string;
  saltEnc: string;
  kdf: Kdf;
}

/** A working copy of an entry while it is being edited. */
export interface Draft extends EntryPlain {
  date: string;
}

// ---------------------------------------------------------------------------
// Encrypted vault items: thoughts and habits share the entry envelope but are
// stored separately from the journal stream.
// ---------------------------------------------------------------------------

export const VAULT_KINDS = ["thought", "habit"] as const;
export type VaultKind = (typeof VAULT_KINDS)[number];

/** Plaintext of a saved random thought. */
export interface ThoughtPlain {
  text: string;
}

/** Plaintext of one tracked habit. Completion days are local `YYYY-MM-DD`. */
export interface HabitPlain {
  name: string;
  /** Key into the app's icon set — never an emoji. */
  icon: string;
  /** Key into the funky accent palette. */
  color: string;
  completions: string[];
}

/** An encrypted vault item as returned by the API (ciphertext only). */
export interface VaultRecord extends EncryptedBlob {
  id: string;
  kind: VaultKind;
  createdAt: string;
  updatedAt: string;
  version: number;
  cryptoVersion: number;
}

/** A decrypted thought with its server metadata attached. */
export interface DecryptedThought extends ThoughtPlain {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  cryptoVersion: number;
}

/** A decrypted habit with its server metadata attached. */
export interface DecryptedHabit extends HabitPlain {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  cryptoVersion: number;
}
