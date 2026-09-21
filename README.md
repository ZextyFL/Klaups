# Klaups

Klaups is a creator control center for TikTok LIVE streamers: Google-only login, verified TikTok creator onboarding, gift-specific sounds, transparent donation/gift alerts, a soundboard, TTS, Spotify song requests, goals, browser-source widgets, creator donation pages and Stripe Connect payouts.

## Architecture

```
apps/web      Next.js dashboard, creator pages, OAuth, Stripe, overlays and tests.
apps/worker   Always-on Node 20+ process for TikTok LIVE chat/gifts/viewer events.
supabase/     PostgreSQL schema, RLS, storage policies and helper RPCs.
```

### Identity and LIVE events are intentionally separate

Klaups uses **official TikTok Login Kit** to prove that a creator controls a TikTok account. OAuth tokens are stored in the server-only `tiktok_oauth_tokens` table and are never readable by the normal browser client.

TikTok Login Kit does not expose the private email used to create a TikTok account, so Klaups does **not** pretend it can compare a Google Gmail address with a TikTok login email. The binding is:

```
Google/Supabase user -> Klaups profile -> unique TikTok open_id
```

TikTok LIVE chat/gifts/viewer events are handled separately by the always-on worker using `tiktok-live-connector`. The worker is unofficial and can break if TikTok changes its LIVE protocol.

## Main creator tools

- **TikTok Gift Reactor** — gifts discovered during LIVE automatically appear in the dashboard. Each gift can have its own MP3/WAV/OGG or built-in sound, volume, duration, visual settings and message template.
- **Donation Alerts** — transparent OBS/TikTok LIVE Studio alerts with presets, GIF/image, sound, volume, TTS, duration and amount tiers.
- **Soundboard** — built-in or uploaded sounds, dashboard hotkeys, and a browser-source audio output.
- **Stream Kit** — one recommended browser source containing donation alerts, TikTok gift alerts, soundboard audio and the daily goal.
- **Live Activity** — unified donation + TikTok gift activity feed.
- **Donations** — modern public support page, Stripe Checkout, creator analytics and top supporters.
- **Widgets** — chat/TTS, viewer count, donation alerts, gift alerts, goal, soundboard and Stream Kit URLs.
- **Payouts** — Stripe Connect onboarding and the Klaups payout ledger.

## Overlays

Browser-source pages use the creator's random `overlay_token`. Keep these URLs private.

```
/overlay/stream-kit?token=...
/overlay/alerts?token=...
/overlay/tiktok-gifts?token=...
/overlay/chat?token=...
/overlay/goal?token=...
/overlay/viewers?token=...
/overlay/soundboard?token=...
```

Donation/gift overlay documents are forced transparent so they can sit over gameplay/video in OBS, TikTok LIVE Studio or Streamlabs.

## One-time setup

### 1. Supabase

Create/link the Klaups Supabase project and run **every migration in `supabase/migrations/` in filename order**.

Important later migrations include:

- `0008_creator_tools.sql` — alert presets + soundboard.
- `0009_oauth_profile_defaults.sql` — better OAuth-created profiles.
- `0010_tiktok_identity_and_gift_alerts.sql` — TikTok identity, gift catalog/config/history and `gift-sounds` storage.
- `0011_tiktok_gift_worker_helpers.sql` — atomic gift recording RPC for the worker.
- `0012_donation_alert_volume.sql` — per-donation alert volume.
- `0013_creator_donation_analytics.sql` — fast creator donation stats/top supporters.

Set Supabase Auth URL Configuration:

- Site URL: `https://klaups.com`
- Redirect URL: `https://klaups.com/auth/callback`
- Also allow your Netlify preview/local callback URLs when testing.

### 2. Google-only auth

Klaups deliberately has no password login UI.

In Supabase:

1. Authentication -> Providers -> enable **Google**.
2. Configure the Google OAuth client ID/secret.
3. Add the Supabase-provided Google OAuth callback URL to Google Cloud.
4. **Disable Email/password auth** in the Klaups Supabase project if you want the provider disabled at the auth-service level too. The app itself also rejects non-Google dashboard sessions.

Google auth opens in a popup. The callback exchanges the code server-side, posts success back to the opener and sends new creators to TikTok onboarding.

### 3. TikTok Login Kit

Create a TikTok for Developers app with Login Kit.

Add:

```
https://klaups.com/api/tiktok/callback
```

as the redirect URI, then configure:

```
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_PROFILE_SCOPE_ENABLED=false
```

`user.info.basic` is enough to verify ownership using the creator's TikTok `open_id`.

If TikTok approves `user.info.profile` for the app, set:

```
TIKTOK_PROFILE_SCOPE_ENABLED=true
```

and Klaups will also request/read the TikTok username automatically. Until then, a verified creator can enter their LIVE username during onboarding so the LIVE worker knows which room to watch.

### 4. TikTok LIVE worker

Deploy `apps/worker` as an always-on Node **20+** service on Railway, Render, Fly.io or a VPS — not as a Netlify function.

Configure the worker variables from `apps/worker/.env.example`, especially:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

The worker:

- reconnects to enabled creators;
- forwards chat and viewer updates;
- waits until streak gifts finish before emitting the gift;
- records gift history/discovery;
- caches per-gift alert configuration briefly;
- broadcasts gift events into the same private overlay realtime topic.

### 5. Stripe

Enable Stripe Connect Express and set the variables from `apps/web/.env.example`.

Create a webhook endpoint:

```
https://klaups.com/api/webhooks/stripe
```

Listen for:

- `checkout.session.completed`
- `account.updated`
- `payout.paid`
- `payout.failed`

Stripe Checkout uses automatic payment methods, so methods such as cards and eligible local methods can appear based on the Stripe account, currency and customer.

Creators verify payout details through Dashboard -> Verify account.

### 6. Spotify

Create a Spotify app and add:

```
https://klaups.com/api/spotify/callback
http://localhost:3000/api/spotify/callback
```

Configure `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` for both web and worker. Song queueing requires Spotify Premium and an active playback device.

## Testing creator alerts

The dashboard test buttons intentionally broadcast through the **same Supabase Realtime topic** as real events.

- **Test donation** -> real donation alert browser source, but no fake financial record/balance change.
- **Test gift** -> real TikTok gift overlay channel and that gift's configured sound.
- **Preview sound** -> plays locally in the dashboard only.

An alert's configured duration also stops uploaded audio, built-in audio and donation TTS so long files cannot keep playing after the visual disappears.

## Local development

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev

cd apps/worker
npm install
cp .env.example .env
npm run dev
```

Useful checks:

```bash
cd apps/web && npm run typecheck && npm run build
cd apps/worker && npm run typecheck
```

Use the Stripe CLI when testing payments locally:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Deployment notes

The web app is configured for Netlify. Set every required variable in the Netlify environment and redeploy after changing OAuth settings.

The TikTok LIVE worker must stay running independently. If a creator remains on “Connecting…” for a long time, check the worker process/logs and its Supabase service-role environment.

## Before handling meaningful payment volume

Klaups is still an MVP architecture. Before scaling real money flows, add/strengthen:

- admin/moderation tooling for donation messages/TTS;
- rate limiting and abuse controls on public donation/test endpoints;
- monitoring/alerting for Stripe webhook and payout failures;
- stronger secret/token-at-rest handling where appropriate;
- clear creator/supporter terms, privacy policy, refunds/chargeback handling and support workflow;
- backup/restore and incident procedures;
- automated end-to-end tests for OAuth, Stripe, worker gift events and overlays.
