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

  let giftQuery = admin.from('tiktok_seen_gifts').select('*').eq('profile_id', user.id);
  giftQuery = requestedGiftId
    ? giftQuery.eq('gift_id', requestedGiftId)
    : giftQuery.order('last_seen_at', { ascending: false }).limit(1);

  const { data: gifts } = await giftQuery;
  const gift = gifts?.[0] ?? {
    gift_id: 'test-rose',
    gift_name: 'Rose',
    image_url: null,
    diamond_count: 1,
  };

  const { data: alert } = await admin
    .from('tiktok_gift_alerts')
    .select('*')
    .eq('profile_id', user.id)
    .eq('gift_id', String(gift.gift_id))
    .maybeSingle();

  await broadcast(overlayTopic(settings.overlay_token), 'tiktok_gift', {
    giftId: String(gift.gift_id),
    giftName: gift.gift_name,
    giftImageUrl: gift.image_url,
    diamondCount: gift.diamond_count,
    repeatCount: 1,
    senderName: 'Klaups Test',
    senderUniqueId: 'klaups-test',
    soundUrl: alert?.sound_url ?? null,
    volume: alert?.volume ?? giftSettings?.default_volume ?? 100,
    displaySeconds: alert?.display_seconds ?? giftSettings?.default_display_seconds ?? 5,
    showVisual: alert?.show_visual ?? giftSettings?.show_gift_visuals ?? true,
    showSender: alert?.show_sender ?? true,
    showGiftImage: alert?.show_gift_image ?? true,
    messageTemplate: alert?.message_template ?? '{name} sent {gift} x{count}!',
  });

  return NextResponse.json({ ok: true, giftId: String(gift.gift_id), giftName: gift.gift_name });
}
