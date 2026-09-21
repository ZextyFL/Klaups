import { NextResponse } from 'next/server';
import { stripe, applicationFeeCents } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const slug: string | undefined = body?.slug;
  const amountCents: number | undefined = body?.amountCents;
  const donorName: string = (body?.donorName ?? 'Anonymous').toString().slice(0, 40);
  const message: string = (body?.message ?? '').toString().slice(0, 200);

  if (!slug || !amountCents || amountCents < 100 || amountCents > 100_000_00) {
    return NextResponse.json({ error: 'Invalid donation amount' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from('creator_settings')
    .select('profile_id, currency, donation_slug')
    .eq('donation_slug', slug)
    .single();

  if (!settings) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  const feeCents = applicationFeeCents(amountCents);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: settings.currency,
          unit_amount: amountCents,
          product_data: {
            name: `Donation to ${settings.donation_slug}`,
            description: message || undefined,
          },
        },
      },
    ],
    metadata: {
      profile_id: settings.profile_id,
      donor_name: donorName,
      message,
      application_fee_cents: String(feeCents),
    },
    success_url: `${siteUrl()}/donate/${slug}?success=1`,
    cancel_url: `${siteUrl()}/donate/${slug}?canceled=1`,
  });

  // Record the pending donation now so a webhook race never orphans a payment.
  await supabase.from('donations').insert({
    profile_id: settings.profile_id,
    donor_name: donorName,
    message,
    amount_cents: amountCents,
    currency: settings.currency,
    application_fee_cents: feeCents,
    stripe_checkout_session_id: session.id,
    status: 'pending',
  });

  return NextResponse.json({ url: session.url });
}
