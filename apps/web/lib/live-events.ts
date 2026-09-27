// Parses Euler Stream WebSocket frames (JSON, features.rawMessages=0) into
// the small set of events Klaups acts on.
//
// Field names are read defensively across TikTok schema v1 and v2 — they
// differ (e.g. gift image lives at giftDetails.icon.url[0] in v2 and
// giftPictureUrl in v1) and TikTok renames things without notice. Anything
// unrecognised is ignored rather than thrown.

export type LiveUser = { name: string; uniqueId: string | null };

export type LiveEvent =
  | { kind: 'connected' }
  | { kind: 'chat'; user: LiveUser; message: string }
  | {
      kind: 'gift';
      user: LiveUser;
      giftId: string;
      giftName: string;
      imageUrl: string | null;
      diamondCount: number | null;
      repeatCount: number;
      repeatEnd: boolean;
      groupId: string | null;
    }
  | { kind: 'like'; user: LiveUser; count: number }
  | { kind: 'join'; user: LiveUser }
  | { kind: 'follow'; user: LiveUser }
  | { kind: 'share'; user: LiveUser }
  | { kind: 'viewers'; count: number }
  | { kind: 'stream_end' };

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function userOf(data: Any): LiveUser {
  const user = (data?.user ?? {}) as Any;
  const uniqueId = user.uniqueId || user.displayId || null;
  return { name: user.nickname || uniqueId || 'Someone', uniqueId };
}

function firstUrl(image: Any | undefined): string | null {
  const list = image?.url ?? image?.urlList ?? image?.mUrls;
  return Array.isArray(list) && typeof list[0] === 'string' ? list[0] : null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function socialKind(data: Any): 'follow' | 'share' | null {
  const text = [
    data?.common?.displayText?.key,
    data?.common?.displayText?.defaultPattern,
    data?.displayType,
    data?.label,
  ]
    .filter((v) => typeof v === 'string')
    .join(' ');
  if (/follow/i.test(text)) return 'follow';
  if (/share/i.test(text) || (typeof data?.shareType === 'string' && data.shareType && data.shareType !== '0')) return 'share';
  return null;
}

export function parseMessage(message: Any): LiveEvent | null {
  const type = String(message?.type ?? '');
  const data = (message?.data ?? {}) as Any;

  switch (type) {
    case 'tiktok.connect':
      return { kind: 'connected' };
    case 'WebcastChatMessage': {
      const text = String(data.comment ?? data.content ?? '').trim();
      return text ? { kind: 'chat', user: userOf(data), message: text } : null;
    }
    case 'WebcastGiftMessage': {
      const details = (data.giftDetails ?? data.gift ?? {}) as Any;
      const giftId = String(data.giftId ?? details.id ?? '');
      if (!giftId || giftId === '0') return null;
      return {
        kind: 'gift',
        user: userOf(data),
        giftId,
        giftName: String(details.giftName ?? details.name ?? data.giftName ?? 'Gift'),
        imageUrl:
          firstUrl(details.icon) ?? firstUrl(details.image) ?? firstUrl(data.giftImage) ?? (data.giftPictureUrl || null),
        diamondCount: num(details.diamondCount ?? data.diamondCount),
        repeatCount: Math.max(1, num(data.repeatCount) ?? num(data.comboCount) ?? num(data.groupCount) ?? 1),
        repeatEnd: data.repeatEnd === true || Number(data.repeatEnd) === 1,
        groupId: data.groupId ? String(data.groupId) : null,
      };
    }
    case 'WebcastLikeMessage':
      return { kind: 'like', user: userOf(data), count: Math.max(1, num(data.likeCount) ?? 1) };
    case 'WebcastMemberMessage':
      return { kind: 'join', user: userOf(data) };
    case 'WebcastSocialMessage': {
      const kind = socialKind(data);
      return kind ? { kind, user: userOf(data) } : null;
    }
    case 'WebcastRoomUserSeqMessage': {
      const count = num(data.viewerCount) ?? num(data.totalUser);
      return count === null ? null : { kind: 'viewers', count };
    }
    case 'WebcastControlMessage': {
      const action = data.action;
      return Number(action) === 3 || /STREAM_ENDED/i.test(String(action)) ? { kind: 'stream_end' } : null;
    }
    default:
      return null;
  }
}

/** A frame is either a bundle `{ timestamp, messages: [...] }` or one message. */
export function parseFrame(text: string): LiveEvent[] {
  let parsed: Any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const messages: Any[] = Array.isArray(parsed?.messages) ? parsed.messages : parsed?.type ? [parsed] : [];
  const out: LiveEvent[] = [];
  for (const message of messages) {
    const event = parseMessage(message);
    if (event) out.push(event);
  }
  return out;
}

// Euler close codes (from @eulerstream/euler-websocket-sdk ClientCloseCode).
export const CLOSE = {
  NORMAL: 1000,
  STREAM_END: 4005,
  NO_MESSAGES_TIMEOUT: 4006,
  INVALID_OPTIONS: 4400,
  INVALID_AUTH: 4401,
  NO_PERMISSION: 4403,
  NOT_LIVE: 4404,
  TOO_MANY_CONNECTIONS: 4429,
  TIKTOK_CLOSED_CONNECTION: 4500,
  MAX_LIFETIME_EXCEEDED: 4555,
  WEBCAST_FETCH_ERROR: 4556,
  ROOM_INFO_FETCH_ERROR: 4557,
} as const;
