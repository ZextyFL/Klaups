import { getCurrentCreator } from '@/lib/get-current-creator';
import { siteUrl } from '@/lib/site-url';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { CopyField } from '../copy-field';
import { TikTokGiftManager } from './tiktok-gift-manager';
import { buildGiftRows } from './gift-rows';

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

  const defaults = {
    volume: Number(giftSettings?.default_volume ?? 100),
    displaySeconds: Number(giftSettings?.default_display_seconds ?? 5),
    showVisual: giftSettings?.show_gift_visuals ?? true,
  };
  const gifts = buildGiftRows(seen ?? [], alerts ?? [], defaults);

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
                Every popular gift is ready to set up now — pick a sound, how long it stays on
                screen, and test it on your stream before you go LIVE. Gifts your viewers send
                are added automatically.
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
