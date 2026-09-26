// Public TikTok profile + LIVE status reading.
//
// No OAuth, no API key, no developer app: every field here comes from the same
// HTML a logged-out visitor gets from tiktok.com. TikTok server-renders its
// pages from a JSON blob in `__UNIVERSAL_DATA_FOR_REHYDRATION__`, so we parse
// that instead of scraping markup — it is far more stable than CSS selectors,
// though it is still an undocumented surface that TikTok can change. Every
// reader below therefore degrades to "unknown" rather than throwing.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const REHYDRATION_RE =
  /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/;

export type TikTokProfile = {
  username: string;
  nickname: string;
  avatarUrl: string | null;
  verified: boolean;
  /** Non-empty and not "0" while the creator is broadcasting. */
  roomId: string | null;
};

export type TikTokLiveStatus =
  | { live: true; roomId: string | null; viewerCount: number | null; title: string | null }
  | { live: false; reason: 'offline' | 'not_found' | 'unknown' };

export function normalizeUsername(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 24);
}

export function isValidUsername(value: string) {
  return /^[a-zA-Z0-9._]{1,24}$/.test(value);
}

async function fetchRehydration(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const match = REHYDRATION_RE.exec(await res.text());
    if (!match) return null;

    const parsed = JSON.parse(match[1]) as { __DEFAULT_SCOPE__?: Record<string, unknown> };
    return parsed.__DEFAULT_SCOPE__ ?? null;
  } catch {
    // Timeout, network error, malformed JSON, TikTok layout change — all of
    // these mean "we could not read it", never "the creator does not exist".
    return null;
  }
}

/** Reads the public profile card shown on the "is this you?" confirmation. */
export async function fetchTikTokProfile(username: string): Promise<TikTokProfile | null> {
  const scope = await fetchRehydration(`https://www.tiktok.com/@${encodeURIComponent(username)}`);
  if (!scope) return null;

  const detail = scope['webapp.user-detail'] as
    | { statusCode?: number; userInfo?: { user?: Record<string, unknown> } }
    | undefined;

  const user = detail?.userInfo?.user;
  if (!user || detail?.statusCode) return null;

  const roomId = typeof user.roomId === 'string' ? user.roomId : null;

  return {
    username: typeof user.uniqueId === 'string' ? user.uniqueId : username,
    nickname:
      (typeof user.nickname === 'string' && user.nickname) ||
      (typeof user.uniqueId === 'string' && user.uniqueId) ||
      username,
    avatarUrl:
      (typeof user.avatarLarger === 'string' && user.avatarLarger) ||
      (typeof user.avatarMedium === 'string' && user.avatarMedium) ||
      (typeof user.avatarThumb === 'string' && user.avatarThumb) ||
      null,
    verified: Boolean(user.verified),
    roomId: roomId && roomId !== '0' ? roomId : null,
  };
}

/**
 * Is this creator broadcasting right now?
 *
 * Primary signal is the /live page, which carries the room status and viewer
 * count. TikTok uses status 2 for "live" and 4 for "ended". We deliberately
 * treat any other status as offline rather than guessing.
 *
 * If the /live page can't be read we fall back to the profile page's roomId,
 * which is only populated while broadcasting. Two independent signals means a
 * single TikTok layout change degrades the feature instead of breaking it.
 */
export async function fetchTikTokLiveStatus(username: string): Promise<TikTokLiveStatus> {
  const scope = await fetchRehydration(
    `https://www.tiktok.com/@${encodeURIComponent(username)}/live`
  );

  const detail = scope?.['webapp.live-detail'] as
    | {
        liveRoomUserInfo?: {
          liveRoom?: { status?: number; title?: string };
          stats?: { userCount?: number };
          user?: { roomId?: string };
        };
      }
    | undefined;

  const room = detail?.liveRoomUserInfo;
  const status = room?.liveRoom?.status;

  if (status === 2) {
    const viewerCount = Number(room?.stats?.userCount);
    return {
      live: true,
      roomId: room?.user?.roomId ?? null,
      viewerCount: Number.isFinite(viewerCount) ? viewerCount : null,
      title: room?.liveRoom?.title ?? null,
    };
  }

  if (typeof status === 'number') {
    return { live: false, reason: 'offline' };
  }

  // /live was unreadable — ask the profile page instead.
  const profile = await fetchTikTokProfile(username);
  if (!profile) return { live: false, reason: 'not_found' };
  if (profile.roomId) {
    return { live: true, roomId: profile.roomId, viewerCount: null, title: null };
  }

  return { live: false, reason: scope ? 'offline' : 'unknown' };
}
