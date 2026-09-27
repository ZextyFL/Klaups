import { EVENT_CATALOG, EVENT_DEFAULT_TEMPLATE, GIFT_CATALOG, giftNameKey } from '@/lib/gift-catalog';

export type GiftRow = {
  /** Stable React key and merge key (name key or event key). */
  rowKey: string;
  /** The gift_id alerts for this row are saved under. */
  giftId: string;
  giftName: string;
  kind: 'gift' | 'event';
  icon: string;
  imageUrl: string | null;
  diamondCount: number | null;
  timesReceived: number;
  seenLive: boolean;
  configured: boolean;
  enabled: boolean;
  soundUrl: string | null;
  volume: number;
  displaySeconds: number;
  waitForSound: boolean;
  showVisual: boolean;
  showSender: boolean;
  showGiftImage: boolean;
  messageTemplate: string;
};

type SeenGift = {
  gift_id: string | number;
  gift_name: string;
  image_url: string | null;
  diamond_count: number | null;
  times_received: number | string | null;
};

type Alert = {
  gift_id: string;
  gift_name: string;
  enabled: boolean;
  sound_url: string | null;
  volume: number | string;
  display_seconds: number | string;
  wait_for_sound?: boolean | null;
  show_visual: boolean;
  show_sender: boolean;
  show_gift_image: boolean;
  message_template: string;
};

const DEFAULT_TEMPLATE = '{name} sent {gift} x{count}!';

/**
 * One row per gift a creator might care about: every catalog gift, every gift
 * actually received live, every custom gift they added, plus follow/share.
 * A live-seen gift is merged onto the catalog entry of the same name so Rose
 * never appears twice.
 */
export function buildGiftRows(
  seen: SeenGift[],
  alerts: Alert[],
  defaults: { volume: number; displaySeconds: number; showVisual: boolean }
): GiftRow[] {
  const rows = new Map<string, GiftRow>();

  const blank = (rowKey: string, giftId: string, name: string, kind: 'gift' | 'event', icon: string): GiftRow => ({
    rowKey,
    giftId,
    giftName: name,
    kind,
    icon,
    imageUrl: null,
    diamondCount: null,
    timesReceived: 0,
    seenLive: false,
    configured: false,
    enabled: true,
    soundUrl: null,
    volume: defaults.volume,
    displaySeconds: defaults.displaySeconds,
    waitForSound: false,
    showVisual: defaults.showVisual,
    showSender: true,
    showGiftImage: true,
    messageTemplate: EVENT_DEFAULT_TEMPLATE[giftId] ?? DEFAULT_TEMPLATE,
  });

  for (const event of EVENT_CATALOG) {
    rows.set(event.key, blank(event.key, event.key, event.name, 'event', event.icon));
  }
  for (const item of GIFT_CATALOG) {
    const row = blank(item.key, item.key, item.name, 'gift', item.icon);
    row.diamondCount = item.diamonds;
    rows.set(item.key, row);
  }

  const byRealId = new Map<string, GiftRow>();
  for (const gift of seen) {
    const key = giftNameKey(gift.gift_name);
    const row = rows.get(key) ?? blank(key, String(gift.gift_id), gift.gift_name, 'gift', '🎁');
    row.giftId = String(gift.gift_id);
    row.imageUrl = gift.image_url ?? row.imageUrl;
    row.diamondCount = gift.diamond_count ?? row.diamondCount;
    row.timesReceived = Number(gift.times_received ?? 0);
    row.seenLive = true;
    rows.set(key, row);
    byRealId.set(row.giftId, row);
  }

  // Alerts saved under a real id win over ones saved under the name key.
  const ordered = [...alerts].sort(
    (a, b) => Number(a.gift_id.startsWith('name:')) - Number(b.gift_id.startsWith('name:'))
  );
  for (const alert of ordered) {
    const isEvent = alert.gift_id.startsWith('event:');
    const key = isEvent ? alert.gift_id : giftNameKey(alert.gift_name);
    let row = byRealId.get(alert.gift_id) ?? rows.get(key);
    if (!row) {
      row = blank(key, alert.gift_id, alert.gift_name, 'gift', '🎁');
      rows.set(key, row);
    }
    if (row.configured) continue;

    row.giftId = alert.gift_id;
    row.configured = true;
    row.enabled = alert.enabled;
    row.soundUrl = alert.sound_url;
    row.volume = Number(alert.volume);
    row.displaySeconds = Number(alert.display_seconds);
    row.waitForSound = Boolean(alert.wait_for_sound);
    row.showVisual = alert.show_visual;
    row.showSender = alert.show_sender;
    row.showGiftImage = alert.show_gift_image;
    row.messageTemplate = alert.message_template;
  }

  const all = [...rows.values()];
  const events = all.filter((row) => row.kind === 'event');
  const giftsOnly = all
    .filter((row) => row.kind === 'gift')
    .sort((a, b) => (a.diamondCount ?? Infinity) - (b.diamondCount ?? Infinity) || a.giftName.localeCompare(b.giftName));
  return [...events, ...giftsOnly];
}
