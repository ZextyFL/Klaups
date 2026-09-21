# Klaups worker

Connects to each live-enabled creator's TikTok LIVE room (via the unofficial
[`tiktok-live-connector`](https://www.npmjs.com/package/tiktok-live-connector)
library — no TikTok API key needed) and forwards chat messages, gifts and
`!sr` song-request commands to the web app in real time over Supabase
Realtime broadcast. It also queues song requests on the creator's Spotify.

**This cannot run on Netlify.** Netlify Functions are request/response and
can't hold an open connection to TikTok for the duration of a live stream.
Run this as a normal always-on Node process instead — Railway, Render, Fly.io,
a small VPS, or a background worker dyno all work. It polls Supabase every 30
seconds for creators with `tiktok_worker_enabled = true` and connects/
disconnects automatically, so one deployment serves every creator.

## Setup

```bash
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPOTIFY_CLIENT_ID/SECRET
npm install
npm run dev             # or `npm start` in production
```

## Notes

- `tiktok-live-connector` reverse-engineers TikTok's internal Webcast
  protocol; TikTok can change it at any time, which is why the library warns
  it isn't "production ready." Treat outages as expected and keep the worker
  auto-reconnecting (already handled — see `reconcile()` in `src/index.ts`).
- A creator only shows up here once they flip "Listen to my live chat &
  gifts" on in the dashboard's Integrations page.
