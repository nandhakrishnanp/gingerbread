# Gingerbread — Encrypted Journaling App

**Shared understanding / design plan.** Captured from a grilling session on 2026-10-19.
Name: **gingerbread**. Repo: `C:\Projects\gingerbread`.

---

## 1. Product in one paragraph

A personal, single-user journaling web app. You write daily thoughts in one
chronological stream. Everything is **zero-knowledge encrypted in the browser**
before it ever touches the server — MongoDB only ever stores ciphertext. Access
is protected by a password. You can export your journal to PDF (plus Markdown
and an encrypted JSON backup). Warm, cozy "gingerbread" aesthetic, responsive so
it works on phone and desktop, installable as a PWA.

## 2. The gap we're exploiting

Research (see `journaling-research.md`) shows most popular journal apps *claim*
privacy but don't deliver true end-to-end encryption. Only Day One and Standard
Notes ship E2E-by-default; Penzu/Joplin make it opt-in; Daylio/Obsidian are local
but unencrypted. **"Encrypted by default, in the cloud, with painless PDF export"
is under-served.** That is the product.

## 3. Decisions log (all settled)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Users | Single user |
| 2 | Data location | Full cloud (MongoDB Atlas) |
| 3 | Stack | Next.js (App Router) + MongoDB + TailwindCSS |
| 4 | Encryption | Zero-knowledge, client-side |
| 5 | Devices | Responsive web; desktop + phone; not simultaneous |
| 6 | Journals | One stream |
| 7 | Hosting | Vercel + MongoDB Atlas (`MONGODB_URL` in `.env`) |
| 8 | Login | Split derivation (auth key + separate encryption key) |
| 9 | Account creation | One-time `/setup`, only while DB is empty |
| 10 | Key derivation | Argon2id (WASM), PBKDF2-600k fallback |
| 11 | Cipher | AES-256-GCM, unique IV, AAD = record id + version |
| 12 | Key structure | Envelope: master key wraps per-entry data keys |
| 13 | Recovery | No password reset + optional 32-byte recovery key |
| 14 | v1 scope | Entries, one stream, CRUD+autosave, calendar/timeline, client search, tags, PDF export |
| 15 | Editor | Markdown with light toolbar |
| 16 | Export | PDF + Markdown + encrypted JSON backup |
| 17 | Offline/UX | Installable PWA; auto-lock ~15 min idle and on tab close |
| 18 | Sync | Per-record last-write-wins (`updatedAt` + version counter) |
| 19 | Version history | Keep last ~10 encrypted revisions per entry |
| 20 | Search | Client-side MiniSearch index, rebuilt on unlock |
| 21 | Session | httpOnly Secure cookie; master key in JS memory only |
| 22 | App structure | App Router + Route Handlers + official `mongodb` driver + Zod + TS strict + pnpm |
| 23 | Metadata leakage | Accept count/size/timestamp leakage in v1; document it |
| 24 | Crypto versioning | `cryptoVersion` stamped on every user + blob |
| 25 | Recovery key format | 32 random bytes, shown once, grouped for transcription |
| 26 | Theme | Warm gingerbread palette, light + dark |

## 4. Architecture

```
Browser (Next.js client, PWA)
 ├─ UI: React + Tailwind ("gingerbread" theme)
 ├─ Editor: Markdown (textarea + light toolbar + preview)
 ├─ Crypto layer (WebCrypto + Argon2id WASM)
 │    password ─► authKey  (server hash)         [salt_auth]
 │    password ─► masterKey (never sent)         [salt_enc]
 │    masterKey wraps per-entry data keys
 │    AES-256-GCM(entry JSON, unique IV, AAD)
 ├─ In-memory search index (MiniSearch over decrypted entries)
 └─ Service worker (offline shell, install prompt)

Vercel (Next.js Route Handlers)
 ├─ /api/auth/*   → setup, login, logout  (stores hash(authKey) only)
 ├─ /api/entries  → CRUD of ciphertext blobs
 └─ No content access; no server-side search; never sees plaintext or keys

MongoDB Atlas
 └─ users, entries, entry_revisions  (ciphertext + opaque metadata only)
```

## 5. Crypto design

- **Setup**: generate random `salt_auth` and `salt_enc`. Client derives
  `authKey = Argon2id(password, salt_auth)` and `masterKey = Argon2id(password, salt_enc)`.
  Sends only `hash(authKey)` (server re-hashes with bcrypt/argon2 before storing).
  Optionally generate a **recovery key** that wraps `masterKey`.
- **Entry encryption**: random data key → `AES-256-GCM` encrypts entry JSON
  `{title?, markdown, tags[]}` with a unique 96-bit IV and `AAD = entryId||version`.
  Data key is wrapped by `masterKey` (AES-KW / AES-GCM). Store the wrapped key.
- **Unlock**: fetch salts → derive keys → decrypt locally. Master key held in
  memory only.
- **Versioning**: every blob carries `cryptoVersion`; parameters recorded so old
  data stays readable when algorithms change.
- **Honesty**: lost password + lost recovery key = lost data. The UI says so.

## 6. Data model (MongoDB)

```
users        { _id, saltAuth, saltEnc, authVerifier, cryptoVersion,
               recoveryWrappedMasterKey?, createdAt }
entries      { _id, userId, date, createdAt, updatedAt, version,
               cryptoVersion, iv, wrappedKey, ciphertext }
entry_revisions { _id, entryId, userId, version, createdAt,
               cryptoVersion, iv, wrappedKey, ciphertext }   // last ~10/entry
```

Plaintext metadata the server can see: entry id, owner, date, timestamps,
sizes, version. Documented in a privacy note.

## 7. API surface (Route Handlers)

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/auth/status` | Is a user set up? session valid? |
| POST | `/api/auth/setup` | One-time account creation (only if DB empty) |
| POST | `/api/auth/login` | Verify authKey, set session cookie |
| POST | `/api/auth/logout` | Clear session |
| GET  | `/api/entries` | List ciphertext metadata + blobs |
| POST | `/api/entries` | Create encrypted entry |
| PATCH| `/api/entries/:id` | Update (version-checked, LWW) |
| DELETE| `/api/entries/:id` | Delete |
| GET  | `/api/entries/:id/revisions` | Encrypted revision history |

All request bodies validated with Zod. All handlers server-only.

## 8. Feature scope

**v1 (in)**: dated entries, single stream, create/edit/delete + autosave,
calendar/timeline navigation, client-side full-text search, tags, Markdown
editor, PDF export, Markdown export, encrypted JSON backup/restore, installable
PWA, auto-lock, light/dark gingerbread theme.

**Later (out)**: photos/attachments, mood tracking, prompts/templates, streaks,
reminders, "On This Day," AI features, sharing, multi-journal, passkey unlock.

## 9. UI / UX sketch

- **Unlock screen**: warm, minimal; password field; "use recovery key."
- **Timeline**: reverse-chronological stream grouped by date; jump-to-date rail.
- **Entry view**: date header, tags, Markdown body; edit inline.
- **Search**: instant filter across decrypted entries.
- **Export**: menu → PDF (browser-side), Markdown, encrypted JSON.
- **Theme**: cream/amber/brown, serif headings, light + dark.

## 10. Security & privacy notes

- Deliver over HTTPS; strict CSP; the crypto is only as trustworthy as the JS.
- Never put the master key in `localStorage`/`sessionStorage`.
- Server stores only ciphertext + opaque metadata; no server-side search.
- Document metadata leakage and the "no recovery without password/recovery key" rule.
- The field is silent on audits; a future third-party crypto audit is the
  difference between "claims privacy" and "provable privacy."

## 11. Deployment

- Vercel project; `MONGODB_URL` in environment variables (already in `.env` locally).
- MongoDB Atlas cluster (existing `bhuvan` cluster reachable via the URL).
- ⚠️ The connection string in `.env` currently embeds real credentials — keep it
  out of git, and consider rotating it since it has been shared in plaintext.

## 12. Remaining minor decisions (final confirmation)

1. Argon2id parameters: **m=64 MiB, t=3, p=1** (tune later).
2. Autosave debounce: **~800 ms** after typing stops, plus on blur.
3. Version history cap: **10 revisions** per entry.
4. Session cookie lifetime: **7 days**.
5. Auto-lock idle timeout: **15 minutes**.
6. Package manager: **pnpm**.

## 13. Suggested build milestones

1. Scaffold Next.js + Tailwind + TS + Mongo connection; `/api/auth/status`.
2. Crypto module (Argon2id, AES-GCM, envelope) + unit tests.
3. `/setup` and `/login` with split derivation + cookie session.
4. Entry CRUD API + encrypted blob storage.
5. Timeline UI + Markdown editor + autosave.
6. Client-side search + tags.
7. PDF / Markdown / encrypted JSON export.
8. PWA + auto-lock + light/dark theme polish.
