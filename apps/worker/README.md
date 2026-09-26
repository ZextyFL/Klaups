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
persistent process. One worker deployment serves every creator; `reconcile()`
polls Supabase and starts/stops connections automatically.

Configs are included for three hosts — pick one:

| Host | How | Notes |
| --- | --- | --- |
| **Railway** (easiest) | New project → Deploy from GitHub → set root dir `apps/worker` | Uses `railway.json` + `Dockerfile`. Add env vars in Variables. ~$5/mo. |
| **Render** | New → Blueprint → this repo | Uses `render.yaml` (`rootDir: apps/worker`). Fill the env vars it prompts for. |
| **Fly.io** | `cd apps/worker && fly launch --no-deploy && fly secrets set SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… && fly deploy` | Uses `fly.toml`; health check on `/health`. |

Required env vars everywhere: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Optional: `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` (song requests),
`EULER_API_KEY` (paid signing tier, see `.env.example`).

Verify: logs show `Klaups worker starting…`; press **Connect TikTok LIVE** in
the dashboard while live and the status flips to LIVE within ~30s.

## Operational notes

`tiktok-live-connector` reverse-engineers TikTok's LIVE/Webcast protocol.
TikTok can change that protocol, so monitor worker logs and expect occasional
upstream breakage. The official TikTok OAuth connection in Klaups does not
remove this limitation; it is used for creator identity/ownership, not LIVE
gift ingestion.
