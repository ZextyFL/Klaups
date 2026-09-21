import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcast, overlayTopic } from '@/lib/realtime';

export const runtime = 'nodejs';

async function handleDonationPaid(session: Stripe.Checkout.Session) {
  const supabase = createAdminClient();
  const profileId = session.metadata?.profile_id;
  if (!profileId) return;

  const amountCents = session.amount_total ?? 0;
  const feeCents = Number(session.metadata?.application_fee_cents ?? '0');

  const { data: donation } = await supabase
    .from('donations')
    .update({
      status: 'paid',
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
    })
    .eq('stripe_checkout_session_id', session.id)
    .select('*')
    .single();

  if (!donation) return;

  // Credit the creator's internal balance (money currently lives on the
  // platform Stripe account; the scheduled payout job later transfers it
  // to the creator's connected account and pays it out).
  const { data: balance } = await supabase
    .from('balances')
    .select('available_cents')
    .eq('profile_id', profileId)
    .single();

  await supabase
    .from('balances')
    .upsert({
      profile_id: profileId,
      available_cents: (balance?.available_cents ?? 0) + amountCents - feeCents,
      updated_at: new Date().toISOString(),
    });

  // Bump today's goal.
  const { data: goal } = await supabase.rpc('get_or_create_today_goal', {
    p_profile_id: profileId,
  });
  let updatedGoal = goal;
  if (goal) {
    const { data } = await supabase
      .from('daily_goals')
      .update({ current_amount_cents: goal.current_amount_cents + amountCents })
      .eq('id', goal.id)
      .select('*')
      .single();
    updatedGoal = data ?? goal;
  }

  const { data: settings } = await supabase
    .from('creator_settings')
    .select('overlay_token, min_tts_amount_cents, tts_enabled')
    .eq('profile_id', profileId)
    .single();

  if (!settings) return;

  const { data: alertTiers } = await supabase
    .from('alert_settings')
    .select('*')
    .eq('profile_id', profileId)
    .lte('min_amount_cents', amountCents)
    .order('min_amount_cents', { ascending: false })
    .limit(1);

  const alert = alertTiers?.[0] ?? null;
  const topic = overlayTopic(settings.overlay_token);

  await broadcast(topic, 'donation', {
    donorName: donation.donor_name,
    message: donation.message,
    amountCents,
    currency: donation.currency,
    soundUrl: alert?.sound_url ?? null,
    imageUrl: alert?.image_url ?? null,
    displaySeconds: alert?.display_seconds ?? 6,
    volume: alert?.volume ?? 100,
    messageTemplate: alert?.message_template ?? '{name} donated {amount}!',
    preset: alert?.preset ?? 'clean',
    speak:
      settings.tts_enabled && amountCents >= settings.min_tts_amount_cents
        ? `${donation.donor_name} donated ${(amountCents / 100).toFixed(2)} ${donation.currency.toUpperCase()}${
            donation.message ? `: ${donation.message}` : ''
          }`
        : null,
  });

  if (updatedGoal) {
    await broadcast(topic, 'goal_update', {
      currentAmountCents: updatedGoal.current_amount_cents,
      targetAmountCents: updatedGoal.target_amount_cents,
      currency: updatedGoal.currency,
    });
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  const supabase = createAdminClient();
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const onboarded = Boolean(account.details_submitted);

  await supabase
    .from('creator_settings')
    .update({
      stripe_payouts_enabled: payoutsEnabled,
      stripe_connect_onboarded: onboarded,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_connect_account_id', account.id);
}

async function handlePayoutEvent(payout: Stripe.Payout, status: 'paid' | 'failed') {
  const supabase = createAdminClient();
  await supabase
    .from('payouts')
    .update({ status })
    .eq('stripe_payout_id', payout.id);
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature ?? '',
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleDonationPaid(event.data.object as Stripe.Checkout.Session);
      break;
    case 'account.updated':
      await handleAccountUpdated(event.data.object as Stripe.Account);
      break;
    case 'payout.paid':
      await handlePayoutEvent(event.data.object as Stripe.Payout, 'paid');
      break;
    case 'payout.failed':
      await handlePayoutEvent(event.data.object as Stripe.Payout, 'failed');
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
