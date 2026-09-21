# Klaups

Live tools for TikTok streamers: chat text-to-speech, Spotify song requests,
a personal donation link, a daily goal bar, sound+image donation alerts, and
automatic Stripe payouts every 4 days.

## Architecture

```
apps/web      Next.js site (deployed to Netlify) — dashboard, donation page,
              OBS overlay pages, Stripe checkout + webhook, Spotify OAuth.
apps/worker   Small always-on Node service — connects to TikTok LIVE chat,
              forwards events to apps/web over Supabase Realtime, queues
              Spotify song requests. Deployed separately (NOT Netlify).
supabase/     SQL migrations: schema, RLS policies, storage buckets.
```

Money flow: a viewer pays through Stripe Checkout on the platform's Stripe
account → the webhook credits the creator's balance in our own ledger and
bumps their daily goal in real time → every day a scheduled Netlify function
checks who's due a payout (every `payout_interval_days`, default 4) and
moves their balance to their Stripe **Connect Express** account, then pays
it out to their bank. Creators never see Stripe's default daily payout
schedule — their connected accounts are created with a manual payout
schedule and only ever get paid out by that scheduled function.

Overlays (chat/TTS, alerts, goal bar) are plain pages at
`/overlay/<name>?token=<overlay_token>` meant to be added to OBS as a
browser source. The token is a random UUID that authenticates the overlay
instead of a login — same model as Streamlabs/StreamElements widget URLs.
Events reach them via Supabase Realtime **broadcast** (push-only, nothing
queryable), so the token never needs to double as a database read key.

## One-time setup

### 1. Supabase

1. Create a project at supabase.com.
2. Run the migrations in `supabase/migrations/` in order (SQL editor, or
   `supabase db push` if you link the project with the CLI). `0001_init.sql`
   creates the schema + RLS; `0002_storage.sql` creates the `avatars`,
   `banners` and `alerts` storage buckets and their policies;
   `0003_tiktok_status.sql` adds the TikTok connection-status columns.
   **If you skip this, signup will land you on an error page** — the app
   self-heals missing profile rows, but it can't create tables for you.
   Auth → URL Configuration: set Site URL to `https://klaups.com` and add
   `https://klaups.com/auth/callback` to Redirect URLs so email
   confirmation links log people in. Keep the `*.netlify.app` equivalents
   there too until the domain is fully cut over.
3. Auth → Providers: email/password is enabled by default. Decide whether
   you want "Confirm email" on — the signup flow works either way.
4. Copy the Project URL, anon key and service_role key into
   `apps/web/.env.example` → `.env.local` (or Netlify env vars).

### 2. Stripe

1. Create a Stripe account and enable **Connect** (Dashboard → Connect →
   get started, Express accounts).
2. Get your API keys (Developers → API keys) into `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint pointing at
   `https://klaups.com/api/webhooks/stripe` listening for
   `checkout.session.completed`, `account.updated`, `payout.paid`,
   `payout.failed`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. `PLATFORM_FEE_BPS` is your cut per donation (500 = 5%); it's only used
   for our own ledger math, not a real Stripe application fee, since
   donations land on the platform account first (see Architecture above).

Payouts require each creator to finish Stripe Express onboarding from
**Dashboard → Payouts** in the app — until then their balance just
accumulates and the scheduled payout job skips them.

### 3. Spotify

1. Create an app at developer.spotify.com/dashboard.
2. Add redirect URI `https://klaups.com/api/spotify/callback` (and a
   `http://localhost:3000/api/spotify/callback` one for local dev).
3. Put the client id/secret into `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`
   (needed by both `apps/web` and `apps/worker`).
4. Song requests use `POST /me/player/queue`, which requires **Spotify
   Premium** and an active playback device — the creator needs Spotify open
   (desktop, mobile, or web player) while live.

### 4. TikTok

Nothing to register — `apps/worker` reads a creator's public LIVE room via
their TikTok username, no API key or login required. It's an unofficial,
reverse-engineered connection (see `apps/worker/README.md`), which is the
only way to read TikTok LIVE chat from outside TikTok today.

## Deploying

**Web app → Netlify**

- New site from Git, set the base directory implicitly via `netlify.toml`
  (already configured: base `apps/web`, `@netlify/plugin-nextjs`).
- Add every variable from `apps/web/.env.example` in Site settings →
  Environment variables.
- `apps/web/netlify/functions/process-payouts.ts` runs automatically once a
  day (`schedule: '@daily'`) — no extra setup.

**Worker → anywhere that runs a persistent Node process** (Railway, Render,
Fly.io, a VPS). See `apps/worker/README.md`. It is intentionally not part of
the Netlify deploy.

### Connecting klaups.com

1. Netlify → your site → **Domain management** → **Add a domain** → enter
   `klaups.com` → also add `www.klaups.com` as a domain alias (Netlify then
   redirects one to the other automatically).
2. At your domain registrar's DNS settings, add:
   - Apex (`klaups.com`): an **A** record → `75.2.60.5` (Netlify's load
     balancer), or use Netlify DNS / an ALIAS/ANAME record if your registrar
     supports it — Netlify's domain settings page shows the exact record it
     wants once you add the domain, which takes priority over this if they
     differ.
   - `www`: a **CNAME** record → `klaups.netlify.app`.
3. Wait for DNS to propagate (minutes to a few hours), then Netlify
   auto-provisions a free HTTPS certificate.
4. Set `NEXT_PUBLIC_SITE_URL=https://klaups.com` in Netlify env vars and
   redeploy — donation checkout, Spotify OAuth, and email confirmation links
   all build off this value.
5. Update the Supabase Auth Site URL/Redirect URLs and the Spotify app's
   redirect URI to `https://klaups.com/...` as noted above.

## Local development

```bash
cd apps/web && npm install && cp .env.example .env.local && npm run dev
cd apps/worker && npm install && cp .env.example .env && npm run dev
```

Use the Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`)
to get a local webhook secret while testing donations.

## Known limitations / things to harden before real money flows through this

- The TikTok connection is unofficial and can break when TikTok changes its
  protocol; it's the same approach every third-party TikTok chat/alert tool
  uses, but it is not TikTok's own API.
- The transfer-then-payout step in `process-payouts.ts` can fail if a
  transfer hasn't cleared to "available" on the connected account yet; on
  failure the payout row is marked `failed` and the balance is left intact
  so the next daily run retries. Watch failed payouts in the Stripe
  dashboard for now rather than assuming silent success.
- Spotify tokens are stored as plaintext in `spotify_tokens` protected only
  by RLS + the service-role boundary. Fine for an MVP; consider column-level
  encryption (Supabase Vault/pgsodium) before wider rollout.
- There's no admin/moderation surface yet (e.g. reviewing flagged donation
  messages before they hit TTS/alerts).
