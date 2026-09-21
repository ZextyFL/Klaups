import type { Config } from '@netlify/functions';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Runs once a day. For every creator whose payout is due (available_cents > 0
// and payout_interval_days have passed since last_payout_at), moves their
// balance from the platform Stripe account to their connected account, then
// pays it out to their bank. This is how "we handle payouts every 4 days"
// is implemented — creators never touch Stripe's default daily payout
// schedule, because their connected accounts are created with a manual
// payout schedule (see api/stripe/connect/onboard).
const MIN_PAYOUT_CENTS = 100;

export default async () => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: settingsRows, error } = await supabase
    .from('creator_settings')
    .select('profile_id, currency, payout_interval_days, stripe_connect_account_id')
    .eq('stripe_connect_onboarded', true)
    .eq('stripe_payouts_enabled', true)
    .not('stripe_connect_account_id', 'is', null);

  if (error) {
    console.error('process-payouts: failed to load creator_settings', error);
    return new Response('error', { status: 500 });
  }

  const now = new Date();
  let processed = 0;

  for (const settings of settingsRows ?? []) {
    const { data: balance } = await supabase
      .from('balances')
      .select('*')
      .eq('profile_id', settings.profile_id)
      .single();

    if (!balance || balance.available_cents < MIN_PAYOUT_CENTS) continue;

    const lastPayout = balance.last_payout_at ? new Date(balance.last_payout_at) : null;
    const dueSince = lastPayout
      ? new Date(lastPayout.getTime() + settings.payout_interval_days * 24 * 60 * 60 * 1000)
      : new Date(0);

    if (now < dueSince) continue;

    const periodStart = lastPayout ?? new Date(0);
    const amountCents = balance.available_cents;
    const accountId = settings.stripe_connect_account_id as string;

    const { data: payoutRow } = await supabase
      .from('payouts')
      .insert({
        profile_id: settings.profile_id,
        amount_cents: amountCents,
        currency: settings.currency,
        status: 'pending',
        period_start: periodStart.toISOString(),
        period_end: now.toISOString(),
      })
      .select('*')
      .single();

    try {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: settings.currency,
        destination: accountId,
        transfer_group: payoutRow?.id,
      });

      const payout = await stripe.payouts.create(
        { amount: amountCents, currency: settings.currency },
        { stripeAccount: accountId }
      );

      await supabase
        .from('payouts')
        .update({
          status: 'in_transit',
          stripe_transfer_id: transfer.id,
          stripe_payout_id: payout.id,
        })
        .eq('id', payoutRow?.id);

      await supabase
        .from('balances')
        .update({
          available_cents: balance.available_cents - amountCents,
          last_payout_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('profile_id', settings.profile_id);

      processed += 1;
    } catch (err) {
      console.error(`process-payouts: failed for ${settings.profile_id}`, err);
      await supabase.from('payouts').update({ status: 'failed' }).eq('id', payoutRow?.id);
      // Balance is left untouched so the next scheduled run retries.
    }
  }

  return new Response(JSON.stringify({ processed }), { status: 200 });
};

export const config: Config = {
  schedule: '@daily',
};
