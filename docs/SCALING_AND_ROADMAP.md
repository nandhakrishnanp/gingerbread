# Gingerbread — Scaling Limits and Roadmap

**Status:** living document
**Scope:** current architecture, why it does not scale indefinitely, and a prioritized plan for what comes next.

---

## TL;DR

Gingerbread is currently a **single-user, load-everything** app.

- On unlock, the browser fetches **every entry, thought, and habit** in two API responses.
- It decrypts everything sequentially before showing the journal.
- It keeps ciphertext, plaintext, the search index, and the rendered stream in memory.
- It has **no pagination, virtualization, or incremental sync**.
- It is designed for one account; a second account cannot be created.

This is a good fit for a personal journal with hundreds of entries. It starts to hurt at a few thousand and hits a hard platform limit before it can grow much further. Multi-user support is a separate, larger change.

---

## 1. Current architecture

```
Browser
  ├─ derives authKey + masterKey from the password
  ├─ fetches all ciphertext from /api/entries and /api/vault
  ├─ decrypts every record locally
  ├─ keeps all plaintext in React state
  └─ builds a MiniSearch index over all entries

Server (Next.js route handlers on Vercel)
  ├─ authorizes with an httpOnly session cookie
  ├─ stores and returns ciphertext envelopes
  └─ never holds the master key or plaintext

MongoDB Atlas
  └─ users, entries, entry_revisions, vault_records
```

The encryption model is intentionally zero-knowledge. That constrains where work can be moved: the server cannot search, index, summarize, or decrypt content.

---

## 2. Why the current implementation will not scale

### 2.1 Hard ceiling: every entry in one response

`GET /api/entries` calls `listEntries()`, which loads the full result set:

```ts
find({ userId })
  .sort({ date: -1, updatedAt: -1 })
  .toArray()
```

There is no `limit`, cursor, or offset. The route returns every record in one JSON response.

Vercel Functions have a **4.5 MB request/response body limit**. Crossing it produces `413 FUNCTION_PAYLOAD_TOO_LARGE`; the journal stops loading entirely.

Ciphertext is base64-encoded, so it is roughly 33% larger than the plaintext, plus metadata such as IV, wrapped key, dates, version, and ID.

| Entry size | Approximate wire size | Entries before 4.5 MB |
| ---------: | --------------------: | --------------------: |
|       1 KB |              ~1.7 KB |               ~2,600 |
|       3 KB |              ~4.3 KB |               ~1,000 |
|      10 KB |             ~13.6 KB |                 ~330 |

Long entries, images, or large habit histories reduce those numbers further. `GET /api/vault` has the same problem for thoughts and habits, and both collections are loaded on every unlock.

### 2.2 Full decryption on every unlock

`Journal.load()` fetches both collections and then loops over every record:

```ts
for (const record of recs) {
  const plain = await decryptEntry(masterKey, record.id, record.version, record);
  decrypted.push(toDecrypted(record, plain));
}
```

Each record costs several operations:

- base64 decode of the wrapped key
- AES-GCM unwrap of the data key
- base64 decode of the IV and ciphertext
- AES-GCM decrypt
- `JSON.parse`
- a fresh WebCrypto key import

The loop is sequential. At 10,000 entries that is tens of thousands of awaited crypto operations before the journal appears. There is no batching, no web worker, no progress beyond a spinner, and no progressive rendering.

The same full pass runs on every unlock, including after the 15-minute auto-lock and on every page reload. A `409` save conflict also calls `load()` and repeats the whole process.

### 2.3 Everything is held in memory

While unlocked, the app keeps:

- `records`: every encrypted entry
- `entries`: every decrypted entry
- `vault`: every encrypted thought and habit
- `thoughts` and `habits`: decrypted copies
- the MiniSearch index
- the rendered React tree

The data exists in at least two forms, plus index structures and DOM nodes. On a phone, a large journal can push a browser tab into hundreds of MB and cause the OS to reload or terminate the page.

### 2.4 The UI renders the whole stream

`JournalView` maps every entry in `visible` to a card. There is no virtualization.

A thousand entries means a thousand cards, each with tags, text, and controls. Ten thousand is a very heavy DOM.

Every unlock also rebuilds:

- `allTags` by looping all entries
- the MiniSearch index by tokenizing all entries
- `visible` by filtering and sorting all entries
- the date counts used by the week strip

Search and tag changes re-run the filter and sort over the full array. These operations are memoized, but their inputs are still the entire journal.

### 2.5 Server and database work grows with the journal

`toArray()` materializes every matching MongoDB document in the function's memory. `NextResponse.json` then serializes the entire result into another large string.

So the server holds:

- the Mongo result set
- the mapped payload array
- the complete JSON string

At a few thousand entries this is tolerable. At tens of thousands it becomes slow, memory-heavy, and expensive in Atlas egress. There is no ETag, conditional request, or incremental fetch, so every reload transfers everything again.

Writes also have amplification. `updateEntry` performs several round trips:

1. `findOne` the current entry
2. `insertOne` a revision
3. `find` stale revisions
4. `deleteMany` stale revisions
5. `replaceOne` the entry

For a single user with an 800 ms autosave debounce this is fine. It becomes a problem with many users or very frequent writes.

### 2.6 Multi-user is blocked, not just slow

If "scale" means many users, the current code cannot do it:

- `/api/auth/setup` only succeeds while the database has **zero users**.
- `getSingleUser()` returns the first user.
- The UI has no signup flow for a second account.

The `userId` fields and session payload anticipate multi-tenancy, but setup and lookup enforce a single-user app. Supporting multiple users is a product and auth redesign, not a performance tweak.

### 2.7 Encryption limits what can be offloaded

The server cannot search or decrypt. That is the point of the product.

Consequences:

- Search must run on plaintext in the browser.
- Streaks and heatmaps need dates. Dates are plaintext metadata, so the server could return date aggregates without seeing content.
- Pagination can reduce transfer and decrypt cost for the feed.
- Global search still wants all history locally, unless the app maintains a local index, searches only loaded pages, or syncs remaining pages in the background.

Pagination alone fixes the feed, not necessarily search.

### 2.8 Offline support is shell-only

The service worker caches the app shell. It does not cache API responses, queue writes, or make the journal readable offline. The app is installable, but not offline-first.

---

## 3. Where it breaks

| Scale                     | What happens                                                                 |
| ------------------------- | ---------------------------------------------------------------------------- |
| Hundreds of entries       | Comfortable                                                                  |
| ~1,000–2,500 entries      | Approaching the 4.5 MB response limit, depending on entry length             |
| ~2,000–5,000 entries      | Unlock delay and memory pressure on phones become noticeable                 |
| ~10,000+ entries          | Slow unlocks, heavy DOM, possible tab crashes, likely payload failures       |
| Multiple users            | Not supported by the current setup and single-user lookup                    |

These are estimates, not guarantees. Entry length, device memory, browser, and network all move the thresholds.

---

## 4. Roadmap

### Priority 1 — Make it solid at scale and on a phone

| Item                            | Why                                                                 |
| ------------------------------- | ------------------------------------------------------------------- |
| Cursor pagination for entries   | Removes the 4.5 MB ceiling and makes initial load bounded            |
| Cursor pagination for thoughts  | Same problem, smaller dataset                                       |
| Lazy decryption                 | Decrypt only the pages that are shown                               |
| Virtualized feed                | Keeps the DOM small when many entries are loaded                    |
| Background sync                 | Load remaining pages after the first screen is interactive          |
| Web worker decryption           | Keeps base64 and JSON work off the main thread                      |
| Date aggregation endpoint       | Powers streak and heatmap without loading all entries               |
| Search strategy                 | Full local index, search-loaded-pages, or background sync           |
| Offline write queue             | Queue ciphertext writes in IndexedDB; make the journal usable offline |
| Push reminders                  | Daily check-in, streak-at-risk, and habit reminders                 |
| Security hardening              | Strict CSP, security headers, credential rotation, dependency checks |
| Monitoring and backups          | Error tracking without content, automated MongoDB backups           |

Habits should probably remain fully loaded. The dataset is small and streak/calendar calculations need the full completion history.

Suggested pagination contract:

```text
GET /api/entries?limit=30&before=<date>,<id>
  → { entries: [...], nextCursor: "<date>,<id>" | null }

GET /api/vault?kind=thought&limit=30&before=<createdAt>,<id>
  → { records: [...], nextCursor: "..." | null }
```

Add indexes that match the cursors, for example `{ userId: 1, date: -1, _id: -1 }`.

### Priority 2 — Deepen the journal

| Item                        | Notes                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| Calendar / jump-to-date     | Promised in the original UX sketch but not built                      |
| Mood tracking               | Natural companion to entries and streaks                              |
| Prompts and templates       | Helps on days when starting is hard                                   |
| "On This Day"               | Resurfaces past entries; needs efficient date lookups                 |
| Encrypted attachments       | Photos and audio, chunked and encrypted client-side                   |
| Habit upgrades              | Weekly schedules, archive, per-habit notes, reminder times            |
| Thought upgrades            | Pinning, tags, search, convert a thought into an entry                |
| PDF improvements            | Embed a Unicode font so non-Latin text and symbols render correctly   |

### Priority 3 — Trust, portability, and account resilience

| Item                        | Notes                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| Third-party crypto audit    | Turns "we claim privacy" into independently reviewed privacy          |
| Crypto v2                   | Use the existing `cryptoVersion` to add key rotation and re-wrapping   |
| Passkey unlock              | WebAuthn PRF can wrap the master key; password remains the fallback    |
| Multi-device key transfer   | QR or short-code transfer so a new phone does not need the password    |
| Automatic encrypted backups | Optional WebDAV/S3 destination, or a scheduled backup reminder         |
| Import from other apps      | Day One, Markdown folders, plain text                                 |
| Session/device management   | See and revoke active sessions                                       |

### Priority 4 — Bigger bets

- **Multi-journal** — separate journals for work, travel, and personal writing.
- **Selective sharing** — share one entry without exposing the master key. Requires a real key-sharing design.
- **Local/on-device AI** — summaries, prompts, and search that never send plaintext to a server.
- **Native wrapper** — if PWA limits on iOS become too restrictive.

---

## 5. Explicit non-goals

These would undo the core promise of the app:

- Server-side plaintext search or AI.
- A password reset that lets the server derive the master key.
- Analytics or crash reporting that captures entry content.
- Storing the master key in `localStorage` or `sessionStorage`.
- Multi-user sharing before key management is designed.

---

## 6. Suggested sequence

1. **Pagination, lazy decryption, and virtualization** — removes the biggest scaling limitation and the hard payload ceiling.
2. **Push reminders** — the highest-value mobile feature.
3. **Security hardening pass** — CSP, credential rotation, dependency checks, audit preparation.
4. **Mood tracking and encrypted attachments** — the most natural product additions after the foundation is solid.

---

## 7. Open questions

- What is the target journal size: 1,000 entries, 10,000, or ten years of daily writing?
- Should global search cover all history, or only loaded pages?
- Is offline writing a requirement, or is the current installable shell enough?
- Should the app remain single-user, or is multi-user a goal?
- Is a daily reminder acceptable, or are per-habit reminder times needed?
- Which Vercel plan will run scheduled reminders, given Hobby cron limits?

---

## 8. Estimates and assumptions

The size and timing numbers in this document are rough estimates based on:

- base64 overhead of about 33%
- typical 1–10 KB journal entries
- Vercel's 4.5 MB function payload limit
- mobile browser memory constraints
- sequential WebCrypto calls per record

Real limits depend on entry length, device, browser, network, and the number of revisions or vault items. Measure with representative data before committing to a hard product limit.
