import { createAdminClient } from '@/lib/supabase/admin';
import { giftNameKey } from '@/lib/gift-catalog';

// Server-side alert resolution shared by the browser LIVE connector's ingest
// route. Mirrors the worker's fireGift/fireEventAlert so both paths produce
// identical `tiktok_gift` payloads for the overlay.

export type Broadcast = { event: string; payload: Record<string, unknown> };

export type GiftInput = {
  giftId: string;
  giftName: string;
  imageUrl: string | null;
  diamondCount: number | null;
  repeatCount: number;
  senderName: string;
  senderUniqueId: string | null;
};

async function loadConfig(profileId: string) {
  const admin = createAdminClient();
  const [{ data: settings }, { data: alerts }] = await Promise.all([
    admin
      .from('tiktok_gift_settings')
      .select('alerts_enabled, default_volume, default_display_seconds, show_gift_visuals')
      .eq('profile_id', profileId)
      .maybeSingle(),
    admin
      .from('tiktok_gift_alerts')
      .select('gift_id, gift_name, enabled, sound_url, volume, display_seconds, wait_for_sound, show_visual, show_sender, show_gift_image, message_template')
      .eq('profile_id', profileId),
  ]);
  return {
    alertsEnabled: settings?.alerts_enabled ?? true,
    defaultVolume: Number(settings?.default_volume ?? 100),
    defaultDisplaySeconds: Number(settings?.default_display_seconds ?? 5),
    showGiftVisuals: settings?.show_gift_visuals ?? true,
    byId: new Map((alerts ?? []).map((a) => [String(a.gift_id), a])),
    byName: new Map((alerts ?? []).map((a) => [giftNameKey(String(a.gift_name)), a])),
  };
}

export async function resolveGift(profileId: string, gift: GiftInput): Promise<Broadcast[]> {
  const admin = createAdminClient();
  await admin.rpc('record_tiktok_gift', {
    p_profile_id: profileId,
    p_gift_id: gift.giftId,
    p_gift_name: gift.giftName,
    p_image_url: gift.imageUrl,
    p_diamond_count: gift.diamondCount,
    p_sender_name: gift.senderName,
    p_sender_unique_id: gift.senderUniqueId,
    p_repeat_count: gift.repeatCount,
  });

  const out: Broadcast[] = [
    {
      event: 'chat_message',
      payload: { username: gift.senderName, message: `sent ${gift.giftName} x${gift.repeatCount}!`, type: 'gift' },
    },
  ];

  const config = await loadConfig(profileId);
  if (!config.alertsEnabled) return out;
  const alert = config.byId.get(gift.giftId) ?? config.byName.get(giftNameKey(gift.giftName));
  if (alert && !alert.enabled) return out;

  out.push({
    event: 'tiktok_gift',
    payload: {
      giftId: gift.giftId,
      giftName: gift.giftName,
      giftImageUrl: gift.imageUrl,
      diamondCount: gift.diamondCount,
      repeatCount: gift.repeatCount,
      senderName: gift.senderName,
      senderUniqueId: gift.senderUniqueId,
      soundUrl: alert?.sound_url ?? null,
      volume: alert?.volume ?? config.defaultVolume,
      displaySeconds: alert?.display_seconds ?? config.defaultDisplaySeconds,
      waitForSound: alert?.wait_for_sound ?? false,
      showVisual: alert?.show_visual ?? config.showGiftVisuals,
      showSender: alert?.show_sender ?? true,
      showGiftImage: alert?.show_gift_image ?? true,
      messageTemplate: alert?.message_template ?? '{name} sent {gift} x{count}!',
    },
  });
  return out;
}

/** Follow/share alerts are opt-in: only when the creator configured one. */
export async function resolveEvent(
  profileId: string,
  key: 'event:follow' | 'event:share',
  senderName: string,
  senderUniqueId: string | null
): Promise<Broadcast[]> {
  const config = await loadConfig(profileId);
  if (!config.alertsEnabled) return [];
  const alert = config.byId.get(key);
  if (!alert || !alert.enabled) return [];
  return [
    {
      event: 'tiktok_gift',
      payload: {
        giftId: key,
        giftName: alert.gift_name,
        giftImageUrl: null,
        diamondCount: null,
        repeatCount: 1,
        senderName,
        senderUniqueId,
        soundUrl: alert.sound_url,
        volume: alert.volume,
        displaySeconds: alert.display_seconds,
        waitForSound: alert.wait_for_sound,
        showVisual: alert.show_visual,
        showSender: alert.show_sender,
        showGiftImage: false,
        messageTemplate: alert.message_template,
        isEvent: true,
      },
    },
  ];
}
