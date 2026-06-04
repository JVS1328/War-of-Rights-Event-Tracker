# Reliable Share Links (season-tracker) — Design

**Date:** 2026-06-03
**Status:** Approved (pending spec review)

## Problem

Sharing a season (and especially a season *with player stats*) from the
season-tracker produces a link that is "far too large to share" — a multi-
hundred-KB `#share=<base64>` URL that cannot be pasted into chat/Discord.

### Root cause

`shareSeason.js` has two link forms:

1. **Short link** (`#s=<8-char id>`) — uploads the compressed payload to a
   server-side store via `POST /api/share`, returns a tiny id.
2. **Inline link** (`#share=<base64>`) — embeds the entire compressed payload
   in the URL hash itself.

Every share handler in `SeasonTracker.jsx` tries the short link first and
**silently falls back to the inline link on any error**:

```js
try { url = await generateShortStatsShareUrl(bundle, ...); }
catch { url = generateStatsShareUrl(bundle, ...); }   // <- the giant URL
```

On Vercel the short path throws every time because **no database is actually
provisioned** — `api/share.js` calls `getRedis()` against an unset
`REDIS_URL`, so the function 500s, the `catch` fires, and the user always gets
the giant inline link.

Secondary contributor: player-stats bundles embed the full `Scoreboard` for
every round, including the entire `kills[]` killfeed and `joinLeaves[]` event
log — these dominate payload size.

## Goal

Share seasons and player-stats reliably as short links, without ever being
handed an unusable giant text-file URL. Scope is deliberately small: make the
existing short-link design actually work. No accounts, no share management UI,
no galleries (explicitly out of scope).

## Design

### 1. Storage — Upstash Redis

Provision **Upstash Redis** via the Vercel dashboard (Storage → Marketplace →
Upstash for Redis), which auto-injects connection env vars into the deployment.

- One entry per share: key `season-share:<id>` → compressed payload string.
- No expiry; links are permanent.
- `id` stays a SHA-256 hash of the payload (existing scheme) → identical
  payloads dedupe to the same id for free.

### 2. `api/share.js` rewrite

Replace `node-redis` (raw TCP, unreliable on serverless functions — dropped
connections between invocations, cold-start failures) with the
`@upstash/redis` HTTP SDK (serverless-native).

- Keep the request contract unchanged so the client needs no API edits:
  - `POST { payload: string }` → `{ id: string }`
  - `GET ?id=<id>` → `{ payload: string }`
  - Same status codes: 400 missing/invalid, 413 too large, 404 not found,
    405 method not allowed.
- Client construction: prefer `Redis.fromEnv()`. The exact env-var names
  injected by the Upstash Vercel integration will be confirmed during
  implementation; if they don't match the SDK's defaults, construct the client
  explicitly from the REST URL + token env vars.
- Raise `MAX_PAYLOAD` from the arbitrary 500 KB to match Upstash's real per-
  value limit (~1 MB on the free tier). Continue returning a clear 413 when
  exceeded.

### 3. Client — stop silently producing giant links

In `SeasonTracker.jsx`, change the share handlers (`shareSeason`,
`shareStats`, and the single-season/event branches) so a store failure
surfaces a user-visible error — e.g. `alert('Couldn\'t create share link —
try again.')` — instead of falling back to the inline generator.

- **Keep** `decodeSharePayload` / `getShareFromUrl` handling of `#share=`
  inline links so previously shared inline links still open.
- The inline `generate*ShareUrl` functions may remain in the module for the
  decoder/back-compat and tests, but are no longer invoked as a fallback by
  the UI.

### 4. Shrink share bundles

- **Strip `joinLeaves` from share/export stats bundles.** Verified unused:
  `joinLeaves` is only written by the parser (`parseScoreboard.ts`) and never
  read by any stats computation or view. Set each scoreboard's `joinLeaves` to
  `[]` when building the shared `StatsBundle` (in `statsBundle.ts`'s
  `buildStatsBundle`, or at the share-bundle boundary).
- Killfeed (`kills[]`) is genuinely consumed (KillfeedTab + statsEngine kill-
  stance/analysis) and stays. Making it an opt-in toggle is an explicit
  **future** step, only if a real event still exceeds the limit.

## Dependencies

- Add `@upstash/redis`.
- Remove `redis` (no longer used).

## Out of scope

- User accounts / per-user saved seasons.
- Share management UI (list/delete/expiry).
- Killfeed opt-in toggle (documented future step).
- Postgres/relational storage.

## Manual step (user)

Provision Upstash Redis in the Vercel dashboard (Storage tab). Code + exact
click-by-click steps will be provided; the env vars are auto-injected by the
integration.

## Testing

- `api/share.js`: covered via the SDK contract; verify POST→GET round-trips
  and the 413/404/405 paths (mock the Upstash client).
- `shareSeason.test.js`: existing encode/decode tests stay green;
  `#share=` inline decoding remains supported.
- Add/adjust a `statsBundle` test asserting `joinLeaves` is stripped from
  built share bundles.
- Manual: deploy, generate a stats share link, confirm it is `#s=<id>` and
  opens to the read-only stats view.
```
