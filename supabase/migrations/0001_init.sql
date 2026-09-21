-- Klaups core schema
-- Creators are Supabase Auth users. All money amounts are stored in cents (integer).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per creator, keyed to auth.users
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  banner_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- creator_settings: platform configuration per creator
-- ---------------------------------------------------------------------------
create table if not exists creator_settings (
  profile_id uuid primary key references profiles(id) on delete cascade,
  donation_slug text unique not null,
  overlay_token uuid not null default gen_random_uuid(),
  currency text not null default 'eur',
  default_daily_goal_cents integer not null default 0,
  min_tts_amount_cents integer not null default 0,
  tts_enabled boolean not null default true,
  tts_voice text default 'default',
  song_request_enabled boolean not null default false,
  song_request_command text not null default '!sr',
  tiktok_username text,
  tiktok_worker_enabled boolean not null default false,
  stripe_connect_account_id text,
  stripe_connect_onboarded boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  payout_interval_days integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists creator_settings_overlay_token_idx on creator_settings(overlay_token);

-- ---------------------------------------------------------------------------
-- alert_settings: sound + image shown per donation tier
-- ---------------------------------------------------------------------------
create table if not exists alert_settings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  min_amount_cents integer not null default 0,
  sound_url text,
  image_url text,
  display_seconds integer not null default 6,
  message_template text not null default '{name} donated {amount}!',
  created_at timestamptz not null default now()
);

create index if not exists alert_settings_profile_idx on alert_settings(profile_id, min_amount_cents desc);

-- ---------------------------------------------------------------------------
-- daily_goals: one row per creator per calendar date (creator-local date)
-- ---------------------------------------------------------------------------
create table if not exists daily_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  goal_date date not null,
  target_amount_cents integer not null default 0,
  current_amount_cents integer not null default 0,
  currency text not null default 'eur',
  created_at timestamptz not null default now(),
  unique (profile_id, goal_date)
);

-- Returns (and lazily creates) today's goal row for a creator.
create or replace function get_or_create_today_goal(p_profile_id uuid)
returns daily_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  g daily_goals;
  s creator_settings;
begin
  select * into s from creator_settings where profile_id = p_profile_id;

  select * into g from daily_goals
    where profile_id = p_profile_id and goal_date = current_date;

  if not found then
    insert into daily_goals (profile_id, goal_date, target_amount_cents, currency)
    values (p_profile_id, current_date, coalesce(s.default_daily_goal_cents, 0), coalesce(s.currency, 'eur'))
    returning * into g;
  end if;

  return g;
end;
$$;

-- ---------------------------------------------------------------------------
-- donations: Stripe-processed direct-support payments
-- ---------------------------------------------------------------------------
create table if not exists donations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  donor_name text not null default 'Anonymous',
  message text,
  amount_cents integer not null,
  currency text not null default 'eur',
  application_fee_cents integer not null default 0,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'pending', -- pending | paid | failed | refunded
  created_at timestamptz not null default now()
);

create index if not exists donations_profile_idx on donations(profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- balances: running available/pending balance per creator (cents, our ledger)
-- ---------------------------------------------------------------------------
create table if not exists balances (
  profile_id uuid primary key references profiles(id) on delete cascade,
  available_cents integer not null default 0,
  currency text not null default 'eur',
  last_payout_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- payouts: our 4-day (configurable) payout runs to the creator's bank
-- ---------------------------------------------------------------------------
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'eur',
  stripe_transfer_id text,
  stripe_payout_id text,
  status text not null default 'pending', -- pending | transferred | in_transit | paid | failed
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists payouts_profile_idx on payouts(profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- spotify_tokens: OAuth tokens for "play music through the app" commands
-- ---------------------------------------------------------------------------
create table if not exists spotify_tokens (
  profile_id uuid primary key references profiles(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  scope text,
  expires_at timestamptz not null,
  spotify_user_id text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- song_requests: log of !sr commands queued to the creator's Spotify
-- ---------------------------------------------------------------------------
create table if not exists song_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  requested_by text not null,
  query text not null,
  track_uri text,
  track_name text,
  artist_name text,
  status text not null default 'queued', -- queued | failed | no_match
  created_at timestamptz not null default now()
);

create index if not exists song_requests_profile_idx on song_requests(profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table creator_settings enable row level security;
alter table alert_settings enable row level security;
alter table daily_goals enable row level security;
alter table donations enable row level security;
alter table balances enable row level security;
alter table payouts enable row level security;
alter table spotify_tokens enable row level security;
alter table song_requests enable row level security;

-- profiles: public read (avatar/banner/display name are shown on donate pages),
-- owner-only write.
create policy "profiles are publicly readable" on profiles for select using (true);
create policy "owner can update own profile" on profiles for update using (auth.uid() = id);
create policy "owner can insert own profile" on profiles for insert with check (auth.uid() = id);

-- creator_settings: only the owner can read/write. Public flows (donate page,
-- overlays, webhooks) go through server-side service-role code instead.
create policy "owner can manage own settings" on creator_settings for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "owner can manage own alerts" on alert_settings for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "owner can manage own goals" on daily_goals for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "owner can read own donations" on donations for select
  using (auth.uid() = profile_id);

create policy "owner can read own balance" on balances for select
  using (auth.uid() = profile_id);

create policy "owner can read own payouts" on payouts for select
  using (auth.uid() = profile_id);

create policy "owner can manage own spotify tokens" on spotify_tokens for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "owner can read own song requests" on song_requests for select
  using (auth.uid() = profile_id);

-- ---------------------------------------------------------------------------
-- Auto-provision profile/settings/balance rows when a new auth user signs up.
-- The signup form passes the chosen username via auth.signUp's
-- `options.data.username`, which lands in raw_user_meta_data.
-- Runs as the table owner so it works even when email confirmation is
-- required and the client has no session yet.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(new.raw_user_meta_data ->> 'username', 'creator-' || substr(new.id::text, 1, 8));

  if exists (select 1 from profiles where username = v_username) then
    v_username := v_username || '-' || substr(new.id::text, 1, 4);
  end if;

  insert into profiles (id, username, display_name)
  values (new.id, v_username, v_username)
  on conflict (id) do nothing;

  insert into creator_settings (profile_id, donation_slug)
  values (new.id, v_username)
  on conflict (profile_id) do nothing;

  insert into balances (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- storage buckets for avatars/banners and alert media are created via the
-- Supabase dashboard/CLI (see README) with public read + owner-folder write.
