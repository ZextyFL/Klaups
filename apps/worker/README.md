# Klaups TikTok LIVE worker

The worker is the always-on realtime side of Klaups. It connects to creators'
TikTok LIVE rooms with `tiktok-live-connector`, forwards chat/viewer events,
records completed gifts and broadcasts gift-specific reactions into each
creator's private Supabase Realtime overlay topic.

Creators link TikTok by username in `apps/web` (Login Kit is optional and only
adds cryptographic ownership proof). Either way the LIVE worker is separate,
because Login Kit does not provide the consumer LIVE event stream used for
chat/gift reactions.

## Requirements

- Node.js 20+
- A running Klaups Supabase project with migrations through at least
  `0011_tiktok_gift_worker_helpers.sql`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Spotify credentials if song requests are enabled

## What it handles

- TikTok LIVE chat -> Klaups chat/TTS overlay
- LIVE viewer count -> viewer widget/dashboard
- completed gift events -> gift history + discovered gift catalog
- per-gift MP3/built-in sound mapping -> `tiktok_gift` realtime event
- streak gifts -> waits for `repeatEnd` so one streak creates one reaction
- Spotify song-request commands
- automatic reconnects for creators with `tiktok_worker_enabled = true`

Each creator gets a supervisor that owns its own retry timer and a stale
watchdog. Three outcomes are kept strictly apart: connected, confirmed-offline
(slow poll, waiting for the next LIVE) and could-not-check (fast burst then
backoff). A creator is never told their stream is offline because *our* check
failed. Any event — chat, gift, like, or the periodic viewer-count push —
counts as proof of life, so a silent LIVE is not mistaken for a dead socket.

Gift configuration is cached briefly per creator so a busy LIVE does not query
Supabase for every gift. Dashboard changes are picked up after the cache
refresh interval.

## Run locally

```bash
cp .env.example .env
npm install
npm run typecheck
npm run dev
```

Production:

```bash
npm install
npm start
```

## Deployment

Do **not** deploy this as a Netlify Function. A LIVE connection needs a
persistent process.

Good targets include Railway, Render, Fly.io, or a VPS. One worker deployment
can serve many creators; `reconcile()` polls Supabase and starts/stops
connections automatically.

## Operational notes

`tiktok-live-connector` reverse-engineers TikTok's LIVE/Webcast protocol.
TikTok can change that protocol, so monitor worker logs and expect occasional
upstream breakage. The official TikTok OAuth connection in Klaups does not
remove this limitation; it is used for creator identity/ownership, not LIVE
gift ingestion.
