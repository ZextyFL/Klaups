import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcast, overlayTopic } from '@/lib/realtime';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const requestedGiftId = typeof body?.giftId === 'string' ? body.giftId : null;
  const admin = createAdminClient();

  const [{ data: settings }, { data: giftSettings }] = await Promise.all([
    admin
      .from('creator_settings')
      .select('overlay_token')
      .eq('profile_id', user.id)
      .single(),
    admin
      .from('tiktok_gift_settings')
      .select('*')
      .eq('profile_id', user.id)
      .maybeSingle(),
  ]);

  if (!settings) return NextResponse.json({ error: 'Creator settings not found' }, { status: 404 });

  const requestedName = typeof body?.giftName === 'string' ? body.giftName.slice(0, 60) : null;

  // Look up the configured alert directly by the key the dashboard saved it
  // under. Previously this only searched gifts already seen live and fell back
  // to a fake "test-rose" id, so testing an unreceived gift ignored its sound.
  const { data: alert } = requestedGiftId
    ? await admin
        .from('tiktok_gift_alerts')
        .select('*')
        .eq('profile_id', user.id)
        .eq('gift_id', requestedGiftId)
        .maybeSingle()
    : { data: null };

  const giftName = alert?.gift_name ?? requestedName ?? 'Rose';
  const isEvent = (requestedGiftId ?? '').startsWith('event:');

  // Use real image/diamonds when this gift has been received live before.
  const { data: seen } = isEvent
    ? { data: null }
    : await admin
        .from('tiktok_seen_gifts')
        .select('gift_id, image_url, diamond_count')
        .eq('profile_id', user.id)
        .ilike('gift_name', giftName)
        .limit(1)
        .maybeSingle();

  await broadcast(overlayTopic(settings.overlay_token), 'tiktok_gift', {
    giftId: requestedGiftId ?? String(seen?.gift_id ?? 'test'),
    giftName,
    giftImageUrl: seen?.image_url ?? null,
    diamondCount: isEvent ? null : (seen?.diamond_count ?? null),
    repeatCount: 1,
    senderName: 'Klaups Test',
    senderUniqueId: 'klaups-test',
    soundUrl: alert ? alert.sound_url : 'builtin:chime',
    volume: alert?.volume ?? giftSettings?.default_volume ?? 100,
    displaySeconds: alert?.display_seconds ?? giftSettings?.default_display_seconds ?? 5,
    waitForSound: alert?.wait_for_sound ?? false,
    showVisual: alert?.show_visual ?? giftSettings?.show_gift_visuals ?? true,
    showSender: alert?.show_sender ?? true,
    showGiftImage: alert?.show_gift_image ?? true,
    messageTemplate:
      alert?.message_template ??
      (requestedGiftId === 'event:follow'
        ? '{name} followed!'
        : requestedGiftId === 'event:share'
          ? '{name} shared the LIVE!'
          : '{name} sent {gift} x{count}!'),
    isEvent,
  });

  return NextResponse.json({ ok: true, giftName });
}
