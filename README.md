# 🍪 Gingerbread

A private, **end-to-end encrypted** journaling web app. You write your daily
thoughts in one chronological stream; everything is encrypted in your browser
before it ever reaches the server. MongoDB only ever stores ciphertext.

> **Status:** early scaffolding. Milestone 1 (project setup + database
> connectivity) is done. See [`PLAN.md`](./PLAN.md) for the full design and
> roadmap.

## How it works

- **Zero-knowledge by design.** Your password derives two separate values in the
  browser: an *auth key* (the server stores only a hash of it) and a *master key*
  (never sent anywhere). Entries are encrypted with AES-256-GCM before upload.
- **The server is a dumb relay.** It stores ciphertext and opaque metadata, and
  can never read, search, or decrypt your entries.
- **One user, one stream.** A personal journal, not a multi-tenant product.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router) + React 19
- [Tailwind CSS](https://tailwindcss.com) v4
- [MongoDB](https://www.mongodb.com) (official driver)
- TypeScript (strict) · [Zod](https://zod.dev) · [jose](https://github.com/panva/jose)

## Getting started

```bash
pnpm install
cp .env.example .env   # then fill in the values
pnpm dev
```

Open http://localhost:3000.

### Environment variables

| Variable        | Required | Description                                            |
| --------------- | -------- | ------------------------------------------------------ |
| `MONGODB_URL`   | yes      | MongoDB connection string (Atlas or self-hosted).      |
| `MONGODB_DB`    | no       | Database name. Defaults to `gingerbread`.              |
| `SESSION_SECRET`| yes      | Random 32-byte base64 string used to sign the session.  |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Scripts

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Start the dev server.              |
| `pnpm build`     | Production build.                  |
| `pnpm start`     | Run the production build.          |
| `pnpm lint`      | Lint with ESLint.                  |
| `pnpm typecheck` | Type-check with `tsc --noEmit`.    |

## Security notes

- The master key lives only in browser memory — never in `localStorage` or a
  cookie.
- Lost password + lost recovery key = lost data. The UI says so.
- The server necessarily sees entry *counts*, *sizes*, and *timestamps*; it never
  sees content.

## Privacy

This is an open-source, single-user app. Don't commit your `.env`.
