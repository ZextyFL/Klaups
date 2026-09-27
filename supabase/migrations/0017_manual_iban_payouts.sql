-- Manual IBAN payouts: creators verify their email, save an IBAN + account
-- holder name, and request a payout; the Klaups team sends it by SEPA.
--
-- Balances are now derived from the ledger (paid donations minus payouts)
-- instead of the mutable balances.available_cents counter. The counter was
-- updated read-then-write from the Stripe webhook, so two concurrent or
-- redelivered webhooks could double-credit or lose a donation.

-- ---------------------------------------------------------------- donations
alter table public.donations add column if not exists paid_at timestamptz;
update public.donations set paid_at = created_at where status = 'paid' and paid_at is null;
create index if not exists donations_profile_paid_idx
  on public.donations(profile_id, paid_at) where status = 'paid';

-- ----------------------------------------------------------- payout account
create table if not exists public.payout_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  account_holder_name text not null check (char_length(account_holder_name) between 2 and 70),
  iban text not null check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  iban_last4 text not null,
  iban_country text not null,
  verified_email text not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payout_accounts enable row level security;

drop policy if exists "owner can read own payout account" on public.payout_accounts;
create policy "owner can read own payout account" on public.payout_accounts
  for select to authenticated using ((select auth.uid()) = profile_id);

-- Column-level: the owner may see everything except the full IBAN. Writes go
-- through the server only, after a fresh email-code check.
revoke all on public.payout_accounts from anon, authenticated;
grant select (profile_id, account_holder_name, iban_last4, iban_country, verified_email, verified_at, updated_at)
  on public.payout_accounts to authenticated;

-- ------------------------------------------------------------------ payouts
alter table public.payouts
  add column if not exists method text not null default 'stripe_connect',
  add column if not exists account_holder_name text,
  add column if not exists iban text,
  add column if not exists iban_last4 text,
  add column if not exists requested_at timestamptz,
  add column if not exists expected_by timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists bank_reference text,
  add column if not exists failure_reason text;

-- Allow the new lifecycle alongside the legacy Stripe statuses.
alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check check (status in (
  'requested', 'processing', 'paid', 'rejected', 'cancelled',
  'pending', 'transferred', 'in_transit', 'failed'
));

-- One open request per creator, enforced by the database.
create unique index if not exists payouts_one_open_request_idx
  on public.payouts(profile_id) where status in ('requested', 'processing');

-- The full IBAN snapshot on a payout row is for the payout team only.
revoke all on public.payouts from anon, authenticated;
grant select (id, profile_id, amount_cents, currency, status, method, account_holder_name, iban_last4,
              requested_at, expected_by, processed_at, paid_at, bank_reference, failure_reason,
              period_start, period_end, created_at)
  on public.payouts to authenticated;

-- ---------------------------------------------------------------- admins
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

-- --------------------------------------------------------------- functions
create or replace function public.payout_hold_days() returns integer
language sql immutable as $$ select 7 $$;

create or replace function public.payout_min_cents() returns integer
language sql immutable as $$ select 1000 $$;

-- pending   = paid donations still inside the chargeback hold window
-- available = matured donations minus everything requested/paid out
create or replace function public.get_creator_balance(p_profile_id uuid)
returns table (
  pending_cents bigint,
  available_cents bigint,
  requested_cents bigint,
  paid_out_cents bigint,
  lifetime_cents bigint,
  currency text,
  hold_days integer,
  min_payout_cents integer,
  next_available_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_hold interval := make_interval(days => public.payout_hold_days());
begin
  if auth.uid() is not null and auth.uid() <> p_profile_id then
    raise exception 'forbidden';
  end if;

  return query
  with d as (
    select
      coalesce(sum(amount_cents - coalesce(application_fee_cents, 0))
        filter (where paid_at > now() - v_hold), 0)::bigint as pending,
      coalesce(sum(amount_cents - coalesce(application_fee_cents, 0))
        filter (where paid_at <= now() - v_hold), 0)::bigint as matured,
      coalesce(sum(amount_cents - coalesce(application_fee_cents, 0)), 0)::bigint as lifetime,
      min(paid_at + v_hold) filter (where paid_at > now() - v_hold) as next_at
    from public.donations
    where profile_id = p_profile_id and status = 'paid' and paid_at is not null
  ), p as (
    select
      coalesce(sum(amount_cents) filter (where status in ('requested', 'processing', 'pending')), 0)::bigint as open,
      coalesce(sum(amount_cents) filter (where status in ('paid', 'in_transit', 'transferred')), 0)::bigint as paid
    from public.payouts
    where profile_id = p_profile_id
  )
  select
    d.pending,
    greatest(d.matured - p.open - p.paid, 0),
    p.open,
    p.paid,
    d.lifetime,
    coalesce((select cs.currency from public.creator_settings cs where cs.profile_id = p_profile_id), 'eur'),
    public.payout_hold_days(),
    public.payout_min_cents(),
    d.next_at
  from d, p;
end;
$$;

revoke all on function public.get_creator_balance(uuid) from public, anon;
grant execute on function public.get_creator_balance(uuid) to authenticated, service_role;

-- Race-free: an advisory lock serialises requests per creator, and the
-- partial unique index above is the final guard.
create or replace function public.request_payout(p_amount_cents integer)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_account public.payout_accounts;
  v_balance record;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtext('klaups:payout:' || v_uid::text));

  select * into v_account from public.payout_accounts where profile_id = v_uid;
  if not found then raise exception 'no_payout_account'; end if;

  if exists (select 1 from public.payouts where profile_id = v_uid and status in ('requested', 'processing')) then
    raise exception 'open_request_exists';
  end if;

  select * into v_balance from public.get_creator_balance(v_uid);
  if p_amount_cents is null or p_amount_cents < public.payout_min_cents() then
    raise exception 'below_minimum';
  end if;
  if p_amount_cents > v_balance.available_cents then
    raise exception 'insufficient_balance';
  end if;

  insert into public.payouts (
    profile_id, amount_cents, currency, status, method,
    account_holder_name, iban, iban_last4,
    requested_at, expected_by, period_start, period_end
  ) values (
    v_uid, p_amount_cents, v_balance.currency, 'requested', 'sepa_manual',
    v_account.account_holder_name, v_account.iban, v_account.iban_last4,
    now(), now() + interval '4 days',
    coalesce((select max(created_at) from public.payouts where profile_id = v_uid), now()),
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_payout(integer) from public, anon;
grant execute on function public.request_payout(integer) to authenticated;

create or replace function public.cancel_payout(p_payout_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.payouts
  set status = 'cancelled'
  where id = p_payout_id and profile_id = auth.uid() and status = 'requested';
  if not found then raise exception 'not_cancellable'; end if;
end;
$$;

revoke all on function public.cancel_payout(uuid) from public, anon;
grant execute on function public.cancel_payout(uuid) to authenticated;
