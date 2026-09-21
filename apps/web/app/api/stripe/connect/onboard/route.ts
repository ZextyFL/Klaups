import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

// Creates (or reuses) the creator's Stripe Express connected account and
// returns an onboarding link. Payouts on that account are set to "manual" —
// we trigger payouts ourselves every N days from process-payouts.ts instead
// of letting Stripe auto-payout daily.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from('creator_settings')
    .select('*')
    .eq('profile_id', user.id)
    .single();

  if (!settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  let accountId = settings.stripe_connect_account_id as string | null;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      settings: {
        payouts: { schedule: { interval: 'manual' } },
      },
      metadata: { profile_id: user.id },
    });
    accountId = account.id;

    await supabase
      .from('creator_settings')
      .update({ stripe_connect_account_id: accountId, updated_at: new Date().toISOString() })
      .eq('profile_id', user.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${siteUrl()}/api/stripe/connect/onboard`,
    return_url: `${siteUrl()}/dashboard/payouts?onboarded=1`,
    type: 'account_onboarding',
  });

  return NextResponse.redirect(link.url, { status: 303 });
}
