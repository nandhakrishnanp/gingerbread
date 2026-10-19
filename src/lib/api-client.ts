import type { Kdf } from "./constants";
import type { EntryRecord } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  return (await res.json()) as T;
}

export interface AuthParams {
  configured: boolean;
  saltAuth?: string;
  saltEnc?: string;
  kdf?: Kdf;
  cryptoVersion?: number;
}

export async function getAuthParams(): Promise<AuthParams> {
  return request<AuthParams>("/api/auth/params");
}

export interface AuthStatus {
  dbOk: boolean;
  configured: boolean;
  authenticated: boolean;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  return request<AuthStatus>("/api/auth/status");
}

export interface SetupPayload {
  saltAuth: string;
  saltEnc: string;
  authKey: string;
  kdf: Kdf;
  recoveryWrappedMasterKey?: string;
  recoveryProof?: string;
  cryptoVersion: number;
}

export async function setupAccount(payload: SetupPayload): Promise<void> {
  await request("/api/auth/setup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(authKey: string): Promise<void> {
  await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ authKey }),
  });
}

/** Exchange a recovery-key proof for a session and the wrapped master key. */
export async function recover(proof: string): Promise<string> {
  const { recoveryWrappedMasterKey } = await request<{
    recoveryWrappedMasterKey: string;
  }>("/api/auth/recover", {
    method: "POST",
    body: JSON.stringify({ proof }),
  });
  return recoveryWrappedMasterKey;
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export async function fetchEntries(): Promise<EntryRecord[]> {
  const { entries } = await request<{ entries: EntryRecord[] }>("/api/entries");
  return entries;
}

export interface NewEntryPayload {
  id: string;
  date: string;
  version?: number;
  cryptoVersion: number;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

export async function createEntryRecord(
  payload: NewEntryPayload,
): Promise<EntryRecord> {
  const { entry } = await request<{ entry: EntryRecord }>("/api/entries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return entry;
}

export interface UpdateEntryPayload {
  version: number;
  date?: string;
  cryptoVersion: number;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

export async function updateEntryRecord(
  id: string,
  payload: UpdateEntryPayload,
): Promise<EntryRecord> {
  const { entry } = await request<{ entry: EntryRecord }>(
    `/api/entries/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return entry;
}

export async function deleteEntryRecord(id: string): Promise<void> {
  await request(`/api/entries/${id}`, { method: "DELETE" });
}

export async function fetchRevisions(id: string): Promise<EntryRecord[]> {
  const { revisions } = await request<{ revisions: EntryRecord[] }>(
    `/api/entries/${id}/revisions`,
  );
  return revisions;
}
