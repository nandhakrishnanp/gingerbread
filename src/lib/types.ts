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

