<p align="center">
  <img src="public/icon-192.png" width="112" height="112" alt="Gingerbread app icon" />
</p>

<h1 align="center">Gingerbread</h1>

<p align="center">
  A warm, private home for your journal, habits, thoughts, and money.<br />
  Journal entries and vault data are <strong>end-to-end encrypted</strong> in your browser before they ever reach the server.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/encryption-AES--256--GCM-6E4C1E" alt="AES-256-GCM encryption" />
  <img src="https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white" alt="Installable PWA" />
</p>

## Screenshots

| Journal | Habits | Streak |
| :-----: | :----: | :----: |
| ![Journal page](src/media/journelpage.jpeg) | ![Habits page](src/media/habitspage.jpeg) | ![Streak page](src/media/streakspage.jpeg) |
| Your daily thread, recent days, and latest thought. | Check off small things every day and keep each flame alive. | Streak stats and the green grid of days you showed up. |

## What it is

Gingerbread is a single-user personal app, not a multi-tenant product. It brings four things into one quiet place:

- **Journal** — one chronological stream of Markdown entries.
- **Habits** — daily check-ins, per-habit calendars, and streaks.
- **Thoughts** — quick encrypted notes that do not belong to a dated entry.
- **Money** — plaintext expense and income tracking with budgets and reports.

It is installable as a PWA, works on phone and desktop, and has light, dark, and system themes.

## Features

### Journal

- Password unlock with split key derivation: an auth key for the server and a separate master key that never leaves the browser.
- Timeline of dated entries, grouped by day, with tag filters and a read-only calendar view.
- Markdown editor with a light toolbar, preview, debounced autosave, manual save (`Ctrl`/`Cmd` + `S`), and per-entry version history.
- Instant client-side search across decrypted entries.
- One-time recovery key at setup. There is no password reset.

### Habits and streaks

- Create habits, check them off each day, and uncheck mistakes.
- Per-habit read-only calendar and completion history.
- Flame and streak views that celebrate consistency without turning it into a guilt machine.
- Habit data lives in the encrypted vault.

### Thoughts

- A lightweight stream for short, encrypted notes.
- Edit and delete with relative timestamps.
- Stored alongside habits in the encrypted vault.

### Money

- Record expenses and income with fixed category presets and Cash / UPI / Card / Bank / Other payment methods.
- Monthly total and per-category budgets.
- Overview and Insights tabs with shared Day / Week / Month / Year period controls.
- Dependency-free SVG charts, including spending trend, category breakdown, payment mix, and biggest expenses.
- Quick expense prompt after closing a newly created journal entry, with Add or Skip.
- A dedicated **All transactions** page with server-side cursor pagination, All / Expenses / Income filters, and edit/delete actions.
- Amounts are stored as integer paise and formatted as INR (`en-IN`).
- Money data is deliberately **plaintext** so it can be totalled on the server. It is not part of the encrypted backup.

### Data ownership

- Export journal entries to **PDF** or **Markdown**.
- Download an **encrypted JSON backup** containing entries, habits, and thoughts; restore from it.
- Export and import **Money** data as plaintext JSON.
- PWA install with an offline app shell.
- Auto-lock after 15 minutes idle; the master key lives only in memory.

## Privacy model

Gingerbread draws a clear line between private writing and practical bookkeeping.

| Data | Storage | Server can read it? |
| --- | --- | --- |
| Journal entries, titles, tags, Markdown | AES-256-GCM ciphertext | No |
| Habits and thoughts | AES-256-GCM ciphertext in the vault | No |
| Money transactions and budgets | Plaintext | Yes |
| Account salts, KDF choice, record counts, timestamps | Plaintext metadata | Yes |

Encryption details:

- Password → two independent keys via Argon2id, with a PBKDF2 fallback for browsers without Argon2id support.
- AES-256-GCM with a unique IV per record and authenticated additional data.
- A master key wraps a per-entry data key; the master key exists only in browser memory.
- The session cookie is HTTP-only and signed; the server stores only a hash of the auth key.

Lost password + lost recovery key = lost encrypted data. The UI says so, and this README says it too.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router) + React 19
- [Tailwind CSS](https://tailwindcss.com) v4
- [MongoDB](https://www.mongodb.com) with the official driver
- TypeScript (strict), [Zod](https://zod.dev), [jose](https://github.com/panva/jose)
- [hash-wasm](https://github.com/Daninet/hash-wasm) for Argon2id
- [marked](https://marked.js.org) + [DOMPurify](https://github.com/cure53/DOMPurify) for Markdown
- [MiniSearch](https://github.com/lucaong/minisearch) for in-memory search
- [jsPDF](https://github.com/parallax/jsPDF) for PDF export
- [Vitest](https://vitest.dev) for unit tests

## Getting started

### Prerequisites

- Node.js 20 or newer
- [pnpm](https://pnpm.io) 12+
- A MongoDB database (Atlas or self-hosted)

### Install

```bash
pnpm install
cp .env.example .env   # then fill in the values
pnpm dev
```

Open <http://localhost:3000>. On first run, Gingerbread sends you to `/setup` to create the single account and show the one-time recovery key.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URL` | yes | MongoDB connection string (Atlas SRV or standard form). |
| `MONGODB_DB` | no | Database name. Defaults to `gingerbread`. |
| `SESSION_SECRET` | yes | Random 32-byte base64 string used to sign the session cookie. |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server. |
| `pnpm build` | Create a production build. |
| `pnpm start` | Run the production build. |
| `pnpm lint` | Lint with ESLint. |
| `pnpm typecheck` | Type-check with `tsc --noEmit`. |
| `pnpm test` | Run the unit tests once. |
| `pnpm test:watch` | Run unit tests in watch mode. |

Regenerate the PWA icons after changing the palette:

```bash
node scripts/generate-icons.mjs
```

## Project structure

```text
src/
  app/
    api/            Route Handlers for auth, entries, vault, budgets, expenses
    views/          Journal, Habits, Streak, Thoughts, Money screens
    journal.tsx     Unlocked app shell and shared state
  lib/
    crypto.ts       Argon2id / PBKDF2 and AES-256-GCM primitives
    entries-service.ts
    vault-service.ts
    expenses-service.ts
    budgets-service.ts
    backup.ts       PDF, Markdown, encrypted JSON, money JSON
    collections.ts  MongoDB collections and indexes
scripts/
  generate-icons.mjs
```

## API overview

| Route | Purpose |
| --- | --- |
| `/api/auth/*` | Setup, login, logout, account params, recovery. |
| `/api/entries` | Encrypted journal entry CRUD. |
| `/api/entries/[id]/revisions` | Encrypted version history. |
| `/api/vault` | Encrypted habits and thoughts. |
| `/api/expenses` | List expenses, or page them with `from`, `to`, `kind`, `limit`, and `cursor`. |
| `/api/expenses/[id]` | Update or delete an expense. |
| `/api/budgets` | Read and save monthly budgets. |

## Deployment

Gingerbread is built for Vercel + MongoDB Atlas.

1. Create a MongoDB Atlas database and connection string.
2. Import the repository into Vercel.
3. Add `MONGODB_URL`, `MONGODB_DB`, and `SESSION_SECRET` to the Vercel project.
4. Deploy. The first visit to the production URL runs `/setup`.

Never commit `.env`, `.env.local`, or connection strings containing real credentials.

## Security notes

- The master key lives only in browser memory — never in `localStorage` or a cookie.
- The server necessarily sees record counts, sizes, timestamps, and all Money data. It never sees journal, habit, or thought content.
- Money export files are plaintext. Treat them like a bank statement.
- Encrypted backups remain encrypted at rest; restore requires the same password and recovery material.
- This is an open-source, single-user app. Please do not commit your `.env`.
