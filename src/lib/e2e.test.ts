import { describe, expect, it } from "vitest";
import {
  bytesToBase64,
  createRecoveryKey,
  createSalts,
  decryptEntry,
  deriveKeys,
  encryptEntry,
  formatRecoveryKey,
  parseRecoveryKey,
  recoveryProof,
  unwrapMasterKeyWithRecovery,
  wrapMasterKeyWithRecovery,
} from "./crypto";

const BASE = process.env.E2E_BASE;

function jar() {
  const store = new Map<string, string>();
  return {
    header: () =>
      [...store.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res: Response) => {
      for (const cookie of res.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const eq = pair.indexOf("=");
        store.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
    },
  };
}

// Opt-in integration test. Runs only when E2E_BASE points at a live server,
// e.g. E2E_BASE=http://localhost:3100 pnpm test
describe.skipIf(!BASE)("live API end-to-end", () => {
  it("setup, create, decrypt, update, revise, delete, recover, login", async () => {
    const base = BASE!;
    const cookies = jar();
    const send = async (path: string, init?: RequestInit) => {
      const res = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Cookie: cookies.header(),
          ...(init?.headers ?? {}),
        },
      });
      cookies.absorb(res);
      return res;
    };

    // 1. Fresh instance
    const params = await (await send("/api/auth/params")).json();
    expect(params.configured).toBe(false);

    // 2. Derive keys locally and create the account
    const saltAuth0 = createSalts();
    const salts = saltAuth0;
    const keys = await deriveKeys("open sesame please", salts.saltAuth, salts.saltEnc);
    const recovery = createRecoveryKey();
    const wrappedMaster = await wrapMasterKeyWithRecovery(recovery, keys.masterKey);
    const proof = await recoveryProof(recovery);

    const setupRes = await send("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({
        ...salts,
        authKey: bytesToBase64(keys.authKey),
        kdf: keys.kdf,
        recoveryWrappedMasterKey: wrappedMaster,
        recoveryProof: proof,
        cryptoVersion: 1,
      }),
    });
    expect(setupRes.status).toBe(201);

    // 3. Create an encrypted entry
    const id = crypto.randomUUID();
    const blob = await encryptEntry(keys.masterKey, id, 0, {
      title: "First light",
      markdown: "The gingerbread is **warm**.",
      tags: ["morning"],
    });
    const createRes = await send("/api/entries", {
      method: "POST",
      body: JSON.stringify({
        id,
        date: "2026-10-19",
        version: 0,
        cryptoVersion: 1,
        ...blob,
      }),
    });
    expect(createRes.status).toBe(201);

    // 4. List + decrypt
    const list = await (await send("/api/entries")).json();
    expect(list.entries).toHaveLength(1);
    const decrypted = await decryptEntry(
      keys.masterKey,
      list.entries[0].id,
      list.entries[0].version,
      list.entries[0],
    );
    expect(decrypted.title).toBe("First light");
    expect(decrypted.tags).toEqual(["morning"]);

    // 5. Update (version 1) then read the revision
    const blob2 = await encryptEntry(keys.masterKey, id, 1, {
      title: "First light",
      markdown: "Now with extra spice.",
      tags: ["morning"],
    });
    const patchRes = await send(`/api/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ version: 1, date: "2026-10-19", cryptoVersion: 1, ...blob2 }),
    });
    expect(patchRes.status).toBe(200);

    const revisions = await (await send(`/api/entries/${id}/revisions`)).json();
    expect(revisions.revisions).toHaveLength(1);
    const old = await decryptEntry(
      keys.masterKey,
      id,
      revisions.revisions[0].version,
      revisions.revisions[0],
    );
    expect(old.markdown).toContain("warm");

    // 6. Optimistic-concurrency conflict is reported
    const staleRes = await send(`/api/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ version: 1, date: "2026-10-19", cryptoVersion: 1, ...blob2 }),
    });
    expect(staleRes.status).toBe(409);

    // 7. Wrong password is rejected
    const badLogin = await send("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ authKey: bytesToBase64(new Uint8Array(32)) }),
    });
    expect(badLogin.status).toBe(401);

    // 8. Recovery unwraps the master key and starts a session
    await send("/api/auth/logout", { method: "POST" });
    const recoverRes = await send("/api/auth/recover", {
      method: "POST",
      body: JSON.stringify({ proof }),
    });
    expect(recoverRes.status).toBe(200);
    const { recoveryWrappedMasterKey } = await recoverRes.json();
    const recovered = await unwrapMasterKeyWithRecovery(
      parseRecoveryKey(formatRecoveryKey(recovery)),
      recoveryWrappedMasterKey,
    );
    expect(bytesToBase64(recovered)).toBe(bytesToBase64(keys.masterKey));

    // 9. Logout then real login
    await send("/api/auth/logout", { method: "POST" });
    const loginRes = await send("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ authKey: bytesToBase64(keys.authKey) }),
    });
    expect(loginRes.status).toBe(200);

    // 10. Delete
    const delRes = await send(`/api/entries/${id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);
    const after = await (await send("/api/entries")).json();
    expect(after.entries).toHaveLength(0);

    // 11. Unauthenticated requests are rejected
    const anon = jar();
    const anonRes = await fetch(`${base}/api/entries`, { headers: { Cookie: anon.header() } });
    expect(anonRes.status).toBe(401);
  }, 90_000);
});
