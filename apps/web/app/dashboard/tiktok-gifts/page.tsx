import { getCurrentCreator } from '@/lib/get-current-creator';
import { siteUrl } from '@/lib/site-url';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { CopyField } from '../copy-field';
import { TikTokGiftManager, type GiftRow } from './tiktok-gift-manager';

export default async function TikTokGiftsPage() {
  const { settings, supabase, user } = await getCurrentCreator();

  const [{ data: seen }, { data: alerts }, { data: giftSettings }, { data: recent }] =
    await Promise.all([
      supabase
        .from('tiktok_seen_gifts')
        .select('*')
        .eq('profile_id', user.id)
        .order('last_seen_at', { ascending: false }),
      supabase
        .from('tiktok_gift_alerts')
        .select('*')
        .eq('profile_id', user.id),
      supabase
        .from('tiktok_gift_settings')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle(),
      supabase
        .from('tiktok_gift_events')
        .select('*')
        .eq('profile_id', user.id)
        .order('received_at', { ascending: false })
        .limit(8),
    ]);

  const alertByGift = new Map((alerts ?? []).map((alert) => [String(alert.gift_id), alert]));
  const seenIds = new Set((seen ?? []).map((gift) => String(gift.gift_id)));

  const gifts: GiftRow[] = (seen ?? []).map((gift) => {
    const alert = alertByGift.get(String(gift.gift_id));
    return {
      giftId: String(gift.gift_id),
      giftName: gift.gift_name,
      imageUrl: gift.image_url,
      diamondCount: gift.diamond_count,
      timesReceived: Number(gift.times_received ?? 0),
      lastSeenAt: gift.last_seen_at,
      alertId: alert?.id ?? null,
      enabled: alert?.enabled ?? true,
      soundUrl: alert?.sound_url ?? null,
      volume: Number(alert?.volume ?? giftSettings?.default_volume ?? 100),
      displaySeconds: Number(alert?.display_seconds ?? giftSettings?.default_display_seconds ?? 5),
      showVisual: alert?.show_visual ?? giftSettings?.show_gift_visuals ?? true,
      showSender: alert?.show_sender ?? true,
      showGiftImage: alert?.show_gift_image ?? true,
      messageTemplate: alert?.message_template ?? '{name} sent {gift} x{count}!',
    };
  });

  for (const alert of alerts ?? []) {
    if (seenIds.has(String(alert.gift_id))) continue;
    gifts.push({
      giftId: String(alert.gift_id),
      giftName: alert.gift_name,
      imageUrl: null,
      diamondCount: null,
      timesReceived: 0,
      lastSeenAt: alert.updated_at,
      alertId: alert.id,
      enabled: alert.enabled,
      soundUrl: alert.sound_url,
      volume: Number(alert.volume),
      displaySeconds: Number(alert.display_seconds),
      showVisual: alert.show_visual,
      showSender: alert.show_sender,
      showGiftImage: alert.show_gift_image,
      messageTemplate: alert.message_template,
    });
  }

  const overlayUrl = `${siteUrl()}/overlay/tiktok-gifts?token=${settings.overlay_token}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="TikTok Gifts"
        description="Turn every TikTok gift into a reaction. Give Roses, Universes and every other gift their own sound, volume and on-screen moment."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="card rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Gift Reactor</p>
              <h2 className="mt-1 text-xl font-semibold">One gift. One reaction.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                Klaups learns the gifts your viewers actually send. Assign a different MP3 or built-in
                sound to each one and test it through the same realtime channel as your LIVE.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              settings.tiktok_status === 'live'
                ? 'bg-green-500/10 text-green-300'
                : 'bg-white/[0.06] text-white/45'
            }`}>
              {settings.tiktok_status === 'live' ? '● LIVE' : 'Waiting for LIVE'}
            </span>
          </div>
        </div>

        <div className="card rounded-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-400">
            Browser source
          </p>
          <p className="mt-2 text-sm text-white/45">Transparent gift alerts + gift audio.</p>
          <div className="mt-4">
            <CopyField label="TikTok Gifts URL" value={overlayUrl} />
          </div>
        </div>
      </div>

      <TikTokGiftManager
        profileId={user.id}
        gifts={gifts}
        initialSettings={{
          alertsEnabled: giftSettings?.alerts_enabled ?? true,
          defaultVolume: Number(giftSettings?.default_volume ?? 100),
          defaultDisplaySeconds: Number(giftSettings?.default_display_seconds ?? 5),
          showGiftVisuals: giftSettings?.show_gift_visuals ?? true,
        }}
      />

      <div className="card rounded-3xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Activity</p>
            <h2 className="mt-1 font-semibold">Recent gifts</h2>
          </div>
          <span className="text-xs text-white/35">{recent?.length ?? 0} shown</span>
        </div>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {(recent ?? []).map((event) => (
            <div key={event.id} className="flex items-center gap-3 py-3">
              {event.gift_image_url ? (
                <img src={event.gift_image_url} alt="" className="h-9 w-9 object-contain" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05]">🎁</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {event.sender_name || 'Viewer'} sent {event.gift_name} ×{event.repeat_count}
                </p>
                <p className="text-xs text-white/35">{new Date(event.received_at).toLocaleString()}</p>
              </div>
              {event.diamond_count !== null && (
                <span className="text-xs font-medium text-cyan-200">
                  ◆ {(event.diamond_count * event.repeat_count).toLocaleString()}
                </span>
              )}
            </div>
          ))}
          {(recent ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-white/40">
              Go LIVE and receive a gift — Klaups will automatically add it here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
