import type { Kdf } from "./constants";
import type {
  BudgetRecord,
  EntryRecord,
  ExpenseInput,
  ExpenseKind,
  ExpenseRecord,
  VaultKind,
  VaultRecord,
} from "./types";

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

/** Encrypted thoughts and habits, newest first. */
export async function fetchVaultRecords(kind?: VaultKind): Promise<VaultRecord[]> {
  const suffix = kind ? `?kind=${kind}` : "";
  const { records } = await request<{ records: VaultRecord[] }>(
    `/api/vault${suffix}`,
  );
  return records;
}

export interface NewVaultPayload {
  id: string;
  kind: VaultKind;
  version?: number;
  cryptoVersion: number;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

export async function createVaultRecord(
  payload: NewVaultPayload,
): Promise<VaultRecord> {
  const { record } = await request<{ record: VaultRecord }>("/api/vault", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return record;
}

export interface UpdateVaultPayload {
  version: number;
  cryptoVersion: number;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
}

export async function updateVaultRecord(
  id: string,
  payload: UpdateVaultPayload,
): Promise<VaultRecord> {
  const { record } = await request<{ record: VaultRecord }>(
    `/api/vault/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return record;
}

export async function deleteVaultRecord(id: string): Promise<void> {
  await request(`/api/vault/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Plaintext money records
// ---------------------------------------------------------------------------

export async function fetchExpenses(): Promise<ExpenseRecord[]> {
  const { expenses } = await request<{ expenses: ExpenseRecord[] }>(
    "/api/expenses",
  );
  return expenses;
}

export interface ExpensePage {
  expenses: ExpenseRecord[];
  nextCursor: string | null;
  total: number;
}

export async function fetchExpensePage(query: {
  from?: string;
  to?: string;
  kind?: ExpenseKind;
  limit?: number;
  cursor?: string;
}): Promise<ExpensePage> {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.kind) params.set("kind", query.kind);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);
  return request<ExpensePage>(`/api/expenses?${params.toString()}`);
}

export interface NewExpensePayload extends ExpenseInput {
  id: string;
}

export async function createExpenseRecord(
  payload: NewExpensePayload,
): Promise<ExpenseRecord> {
  const { expense } = await request<{ expense: ExpenseRecord }>(
    "/api/expenses",
    { method: "POST", body: JSON.stringify(payload) },
  );
  return expense;
}

export async function updateExpenseRecord(
  id: string,
  payload: ExpenseInput,
): Promise<ExpenseRecord> {
  const { expense } = await request<{ expense: ExpenseRecord }>(
    `/api/expenses/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return expense;
}

export async function deleteExpenseRecord(id: string): Promise<void> {
  await request(`/api/expenses/${id}`, { method: "DELETE" });
}

export async function fetchBudgets(): Promise<BudgetRecord[]> {
  const { budgets } = await request<{ budgets: BudgetRecord[] }>("/api/budgets");
  return budgets;
}

export async function saveBudgetRecord(payload: {
  month: string;
  total: number;
  categories: Record<string, number>;
}): Promise<BudgetRecord> {
  const { budget } = await request<{ budget: BudgetRecord }>("/api/budgets", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return budget;
}
