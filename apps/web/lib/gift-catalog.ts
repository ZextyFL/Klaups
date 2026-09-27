// Gifts a creator can configure before they have ever received them.
//
// Alerts for catalog gifts are keyed by name (`name:rose`) rather than
// TikTok's numeric gift id: ids are undocumented and differ by region, but
// the gift name the LIVE stream reports is stable. The worker matches a live
// gift by its real id first, then by this name key, so a sound set here
// fires the first time the gift arrives — and a gift seen live (with its
// real id) is merged onto the catalog entry of the same name.
//
// Diamond values are TikTok's typical coin prices and only shown as a guide;
// the real value from a live gift replaces them once one has been seen.

export type CatalogGift = {
  key: string;
  name: string;
  diamonds: number | null;
  icon: string;
  kind: 'gift' | 'event';
};

export function giftNameKey(name: string) {
  return `name:${name.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

const gift = (name: string, diamonds: number, icon: string): CatalogGift => ({
  key: giftNameKey(name),
  name,
  diamonds,
  icon,
  kind: 'gift',
});

export const GIFT_CATALOG: CatalogGift[] = [
  gift('Rose', 1, '🌹'),
  gift('TikTok', 1, '🎵'),
  gift('GG', 1, '🎮'),
  gift('Ice Cream Cone', 1, '🍦'),
  gift('Heart Me', 1, '💗'),
  gift('Finger Heart', 5, '🫰'),
  gift('Rosa', 10, '🌸'),
  gift('Perfume', 20, '🧴'),
  gift('Doughnut', 30, '🍩'),
  gift('Hand Hearts', 100, '🫶'),
  gift('Confetti', 100, '🎊'),
  gift('Paper Crane', 99, '🕊️'),
  gift('Corgi', 299, '🐕'),
  gift('Money Gun', 500, '💸'),
  gift('Swan', 699, '🦢'),
  gift('Train', 899, '🚂'),
  gift('Galaxy', 1000, '🌌'),
  gift('Fireworks', 1088, '🎆'),
  gift('Interstellar', 10000, '🚀'),
  gift('Rosa Nebula', 15000, '✨'),
  gift('Lion', 29999, '🦁'),
  gift('TikTok Universe', 44999, '🪐'),
];

/** Non-gift LIVE moments that can have their own sound + alert. */
export const EVENT_CATALOG: CatalogGift[] = [
  { key: 'event:follow', name: 'New follower', diamonds: null, icon: '➕', kind: 'event' },
  { key: 'event:share', name: 'LIVE shared', diamonds: null, icon: '🔁', kind: 'event' },
];

export const EVENT_DEFAULT_TEMPLATE: Record<string, string> = {
  'event:follow': '{name} followed!',
  'event:share': '{name} shared the LIVE!',
};
