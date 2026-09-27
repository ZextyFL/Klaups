import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CreatorSettings, Profile } from '@/lib/database.types';

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
}

// Creates the profile/settings/balance rows for a user that has none. This
// is normally done by the handle_new_user() DB trigger; the fallback covers
// projects where the migration ran after the first signups.
async function provisionCreator(userId: string, email: string | undefined, metaUsername: unknown) {
  const admin = createAdminClient();
  const base =
    slugify(typeof metaUsername === 'string' ? metaUsername : '') ||
    slugify(email?.split('@')[0] ?? '') ||
    `creator-${userId.slice(0, 8)}`;

  const { data: taken } = await admin.from('profiles').select('id').eq('username', base).maybeSingle();
  const username = taken && taken.id !== userId ? `${base}-${userId.slice(0, 4)}` : base;

  await admin.from('profiles').upsert({ id: userId, username, display_name: username }, { onConflict: 'id' });
  await admin
    .from('creator_settings')
    .upsert({ profile_id: userId, donation_slug: username }, { onConflict: 'profile_id', ignoreDuplicates: true });
  await admin.from('balances').upsert({ profile_id: userId }, { onConflict: 'profile_id', ignoreDuplicates: true });
}

async function loadCurrentCreator() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [user.app_metadata?.provider].filter(Boolean);

  if (!providers.includes('google')) {
    await supabase.auth.signOut();
    redirect('/login?error=Klaups+only+supports+Google+sign+in');
  }

  const load = () =>
    Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('creator_settings').select('*').eq('profile_id', user.id).maybeSingle(),
      // Balance is derived from the donation/payout ledger, not a counter.
      supabase.rpc('get_creator_balance', { p_profile_id: user.id }),
      supabase
        .from('payout_accounts')
        .select('account_holder_name, iban_last4, iban_country, verified_email, verified_at, updated_at')
        .eq('profile_id', user.id)
        .maybeSingle(),
    ]);

  let [{ data: profile }, { data: settings }, { data: balanceRows }, { data: payoutAccount }] = await load();

  if (!profile || !settings) {
    await provisionCreator(user.id, user.email, user.user_metadata?.username);
    [{ data: profile }, { data: settings }, { data: balanceRows }, { data: payoutAccount }] = await load();
  }

  const balance = ((balanceRows as CreatorBalance[] | null)?.[0] ?? null);

  if (!profile || !settings) {
    redirect('/login?error=Could+not+load+your+creator+profile.+Are+the+database+migrations+applied%3F');
  }

  return {
    supabase,
    user,
    profile: profile as Profile,
    settings: settings as CreatorSettings,
    balance,
    payoutAccount: (payoutAccount as PayoutAccount | null) ?? null,
    /** An email-verified IBAN is on file, so payouts can be requested. */
    payoutReady: Boolean(payoutAccount),
  };
}

// Dashboard layouts and pages both need this data. React cache deduplicates
// the auth/profile/settings/balance fetches within a single server render.
export const getCurrentCreator = cache(loadCurrentCreator);

export type CreatorBalance = {
  pending_cents: number;
  available_cents: number;
  requested_cents: number;
  paid_out_cents: number;
  lifetime_cents: number;
  currency: string;
  hold_days: number;
  min_payout_cents: number;
  next_available_at: string | null;
};

export type PayoutAccount = {
  account_holder_name: string;
  iban_last4: string;
  iban_country: string;
  verified_email: string;
  verified_at: string;
  updated_at: string;
};
