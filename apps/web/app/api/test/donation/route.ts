import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcast, overlayTopic } from '@/lib/realtime';

export const runtime = 'nodejs';

// Fires a fake donation event straight at the creator's own overlay(s) so
// they can preview sound/image/TTS without paying themselves. Nothing is
// written to donations/balances/goals — this is a broadcast-only preview.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const amountCents: number = Number(body?.amountCents) > 0 ? Number(body.amountCents) : 500;

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from('creator_settings')
    .select('overlay_token, currency, tts_enabled, min_tts_amount_cents')
    .eq('profile_id', user.id)
    .single();

  if (!settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  const { data: tiers } = await admin
    .from('alert_settings')
    .select('*')
    .eq('profile_id', user.id)
    .lte('min_amount_cents', amountCents)
    .order('min_amount_cents', { ascending: false })
    .limit(1);

  const alert = tiers?.[0] ?? null;
  const donorName = typeof body?.donorName === 'string' && body.donorName ? body.donorName : 'Test Donor';
  const message = typeof body?.message === 'string' ? body.message : 'This is a test donation!';

  await broadcast(overlayTopic(settings.overlay_token), 'donation', {
    donorName,
    message,
    amountCents,
    currency: settings.currency,
    soundUrl: alert?.sound_url ?? null,
    imageUrl: alert?.image_url ?? null,
    displaySeconds: alert?.display_seconds ?? 6,
    messageTemplate: alert?.message_template ?? '{name} donated {amount}!',
    speak:
      settings.tts_enabled && amountCents >= settings.min_tts_amount_cents
        ? `${donorName} donated ${(amountCents / 100).toFixed(2)} ${settings.currency.toUpperCase()}: ${message}`
        : null,
  });

  return NextResponse.json({ ok: true });
}
