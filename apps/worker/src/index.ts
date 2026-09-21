import 'dotenv/config';
import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { fetchActiveCreators, supabase, type ActiveCreator } from './supabase.js';
import { send } from './broadcast.js';
import { queueSongRequest } from './spotify.js';

const POLL_INTERVAL_MS = 30_000;
const GIFT_CONFIG_TTL_MS = 10_000;

const connections = new Map<string, TikTokLiveConnection>();
const creatorByProfile = new Map<string, ActiveCreator>();
const lastViewerCountWrite = new Map<string, number>();
const VIEWER_COUNT_THROTTLE_MS = 5_000;

type GiftAlert = {
  gift_id: string;
  gift_name: string;
  enabled: boolean;
  sound_url: string | null;
  volume: number;
  display_seconds: number;
  show_visual: boolean;
  show_sender: boolean;
  show_gift_image: boolean;
  message_template: string;
};

type GiftConfigCache = {
  expiresAt: number;
  alertsEnabled: boolean;
  defaultVolume: number;
  defaultDisplaySeconds: number;
  showGiftVisuals: boolean;
  alerts: Map<string, GiftAlert>;
};

const giftConfigCache = new Map<string, GiftConfigCache>();

function displayName(user: { nickname?: string; uniqueId?: string } | undefined) {
  return user?.nickname || user?.uniqueId || 'Someone';
}

async function getGiftConfig(profileId: string): Promise<GiftConfigCache> {
  const cached = giftConfigCache.get(profileId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const [{ data: settings }, { data: alerts }] = await Promise.all([
    supabase
      .from('tiktok_gift_settings')
      .select('alerts_enabled, default_volume, default_display_seconds, show_gift_visuals')
      .eq('profile_id', profileId)
      .maybeSingle(),
    supabase
      .from('tiktok_gift_alerts')
      .select('gift_id, gift_name, enabled, sound_url, volume, display_seconds, show_visual, show_sender, show_gift_image, message_template')
      .eq('profile_id', profileId),
  ]);

  const value: GiftConfigCache = {
    expiresAt: Date.now() + GIFT_CONFIG_TTL_MS,
    alertsEnabled: settings?.alerts_enabled ?? true,
    defaultVolume: Number(settings?.default_volume ?? 100),
    defaultDisplaySeconds: Number(settings?.default_display_seconds ?? 5),
    showGiftVisuals: settings?.show_gift_visuals ?? true,
    alerts: new Map((alerts ?? []).map((alert) => [String(alert.gift_id), alert as GiftAlert])),
  };

  giftConfigCache.set(profileId, value);
  return value;
}

async function startConnection(creator: ActiveCreator) {
  const connection = new TikTokLiveConnection(creator.tiktok_username, {
    fetchRoomInfoOnConnect: true,
  });

  connection.on(WebcastEvent.CHAT, async (data) => {
    const username = displayName(data.user);
    const message = data.content ?? '';
    if (!message) return;

    await send(creator.overlay_token, 'chat_message', { username, message, type: 'chat' });

    if (creator.song_request_enabled) {
      const prefix = creator.song_request_command.toLowerCase();
      if (message.toLowerCase().startsWith(prefix)) {
        const query = message.slice(prefix.length).trim();
        if (query) await handleSongRequest(creator, username, query);
      }
    }
  });

  connection.on(WebcastEvent.GIFT, async (data) => {
    // tiktok-live-connector 2.5 has moved some gift metadata between releases.
    // Read the currently common fields defensively so the worker remains
    // compatible while preserving TypeScript safety at the boundary.
    const raw = data as unknown as {
      giftId?: string | number;
      giftType?: number;
      giftName?: string;
      giftPictureUrl?: string;
      diamondCount?: number;
      repeatCount?: number;
      repeatEnd?: boolean;
      user?: { nickname?: string; uniqueId?: string };
      giftDetails?: {
        giftId?: string | number;
        giftType?: number;
        giftName?: string;
        giftPictureUrl?: string;
        diamondCount?: number;
      };
      gift?: {
        id?: string | number;
        giftId?: string | number;
        type?: number;
        name?: string;
        pictureUrl?: string;
        diamondCount?: number;
        image?: string | { urlList?: string[] };
      };
    };

    const giftType = raw.giftDetails?.giftType ?? raw.gift?.type ?? raw.giftType;
    const isStreakInProgress = giftType === 1 && !raw.repeatEnd;
    if (isStreakInProgress) return;

    const giftId = String(
      raw.giftId ?? raw.giftDetails?.giftId ?? raw.gift?.giftId ?? raw.gift?.id ?? ''
    );
    if (!giftId) return;

    const username = displayName(raw.user);
    const uniqueId = raw.user?.uniqueId ?? null;
    const giftName = raw.giftDetails?.giftName ?? raw.gift?.name ?? raw.giftName ?? 'Gift';
    const repeatCount = Math.max(1, Number(raw.repeatCount ?? 1));
    const diamondCountRaw =
      raw.giftDetails?.diamondCount ?? raw.gift?.diamondCount ?? raw.diamondCount;
    const diamondCount = Number.isFinite(Number(diamondCountRaw))
      ? Number(diamondCountRaw)
      : null;

    const rawImage = raw.gift?.image;
    const giftImageUrl =
      raw.giftDetails?.giftPictureUrl ??
      raw.gift?.pictureUrl ??
      (typeof rawImage === 'string' ? rawImage : rawImage?.urlList?.[0]) ??
      raw.giftPictureUrl ??
      null;

    await supabase.rpc('record_tiktok_gift', {
      p_profile_id: creator.profile_id,
      p_gift_id: giftId,
      p_gift_name: giftName,
      p_image_url: giftImageUrl,
      p_diamond_count: diamondCount,
      p_sender_name: username,
      p_sender_unique_id: uniqueId,
      p_repeat_count: repeatCount,
    });

    await send(creator.overlay_token, 'chat_message', {
      username,
      message: `sent ${giftName} x${repeatCount}!`,
      type: 'gift',
    });

    const config = await getGiftConfig(creator.profile_id);
    if (!config.alertsEnabled) return;

    const alert = config.alerts.get(giftId);
    if (alert && !alert.enabled) return;

    await send(creator.overlay_token, 'tiktok_gift', {
      giftId,
      giftName,
      giftImageUrl,
      diamondCount,
      repeatCount,
      senderName: username,
      senderUniqueId: uniqueId,
      soundUrl: alert?.sound_url ?? null,
      volume: alert?.volume ?? config.defaultVolume,
      displaySeconds: alert?.display_seconds ?? config.defaultDisplaySeconds,
      showVisual: alert?.show_visual ?? config.showGiftVisuals,
      showSender: alert?.show_sender ?? true,
      showGiftImage: alert?.show_gift_image ?? true,
      messageTemplate: alert?.message_template ?? '{name} sent {gift} x{count}!',
    });
  });

  connection.on(WebcastEvent.ROOM_USER, async (data) => {
    const count = Number(data.total ?? 0);
    if (!Number.isFinite(count)) return;

    const now = Date.now();
    const last = lastViewerCountWrite.get(creator.profile_id) ?? 0;
    if (now - last < VIEWER_COUNT_THROTTLE_MS) return;
    lastViewerCountWrite.set(creator.profile_id, now);

    await supabase
      .from('creator_settings')
      .update({ tiktok_viewer_count: count })
      .eq('profile_id', creator.profile_id);
    await send(creator.overlay_token, 'viewer_count', { count });
  });

  connection.on(ControlEvent.CONNECTED, (state) => {
    console.log(`[${creator.tiktok_username}] connected, roomId=${state.roomId}`);
    void setStatus(creator.profile_id, 'live', `Connected to room ${state.roomId}`);
  });

  connection.on(ControlEvent.DISCONNECTED, ({ code, reason }) => {
    console.log(`[${creator.tiktok_username}] disconnected (${code}) ${reason ?? ''}`);
    connections.delete(creator.profile_id);
    lastViewerCountWrite.delete(creator.profile_id);
    giftConfigCache.delete(creator.profile_id);
    void setStatus(creator.profile_id, 'offline', reason || 'Stream ended');
    void supabase
      .from('creator_settings')
      .update({ tiktok_viewer_count: 0 })
      .eq('profile_id', creator.profile_id);
  });

  connection.on(ControlEvent.ERROR, ({ info, exception }) => {
    console.error(`[${creator.tiktok_username}] error`, info, exception?.message);
  });

  await setStatus(creator.profile_id, 'connecting', null);

  try {
    await connection.connect();
    connections.set(creator.profile_id, connection);
  } catch (err) {
    const message = (err as Error).message ?? 'Could not connect';
    console.log(`[${creator.tiktok_username}] connect failed: ${message}`);
    const isOffline = /offline|not live|LIVE has ended/i.test(message);
    await setStatus(
      creator.profile_id,
      isOffline ? 'offline' : 'error',
      isOffline ? 'Not live right now — will connect automatically when you go live' : message
    );
  }
}

async function setStatus(
  profileId: string,
  status: 'disconnected' | 'connecting' | 'live' | 'offline' | 'error',
  message: string | null
) {
  await supabase
    .from('creator_settings')
    .update({
      tiktok_status: status,
      tiktok_status_message: message,
      tiktok_last_seen_at: status === 'live' ? new Date().toISOString() : undefined,
    })
    .eq('profile_id', profileId);
}

async function handleSongRequest(creator: ActiveCreator, requestedBy: string, query: string) {
  const result = await queueSongRequest(creator.profile_id, query);

  await supabase.from('song_requests').insert({
    profile_id: creator.profile_id,
    requested_by: requestedBy,
    query,
    track_uri: result.trackUri ?? null,
    track_name: result.trackName ?? null,
    artist_name: result.artistName ?? null,
    status: result.status,
  });

  const announcement =
    result.status === 'queued'
      ? `Queued "${result.trackName}" by ${result.artistName} for ${requestedBy}!`
      : result.status === 'no_match'
        ? `Couldn't find a track for "${query}".`
        : `Couldn't queue "${query}" — make sure Spotify is open.`;

  await send(creator.overlay_token, 'chat_message', {
    username: 'Klaups',
    message: announcement,
    type: 'song_request',
  });

  if (result.status === 'queued') {
    await send(creator.overlay_token, 'song_request', {
      requestedBy,
      trackName: result.trackName,
      artistName: result.artistName,
    });
  }
}

async function reconcile() {
  const activeCreators = await fetchActiveCreators();
  const activeProfileIds = new Set(activeCreators.map((creator) => creator.profile_id));

  for (const [profileId, connection] of connections) {
    if (!activeProfileIds.has(profileId)) {
      connection.disconnect().catch(() => {});
      connections.delete(profileId);
      creatorByProfile.delete(profileId);
      giftConfigCache.delete(profileId);
      await setStatus(profileId, 'disconnected', null);
    }
  }

  for (const creator of activeCreators) {
    creatorByProfile.set(creator.profile_id, creator);
    if (!connections.has(creator.profile_id)) {
      await startConnection(creator);
    }
  }
}

async function main() {
  console.log('Klaups worker starting…');
  await reconcile();
  setInterval(() => {
    reconcile().catch((err) => console.error('reconcile failed', err));
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error('worker crashed', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  for (const connection of connections.values()) {
    await connection.disconnect().catch(() => {});
  }
  process.exit(0);
});
