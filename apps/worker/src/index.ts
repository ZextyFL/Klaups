import 'dotenv/config';
import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { fetchActiveCreators, supabase, type ActiveCreator } from './supabase.js';
import { send } from './broadcast.js';
import { queueSongRequest } from './spotify.js';
import {
  classifyAttempt,
  nextRetryDelayMs,
  nextWaitingLiveDelayMs,
  WATCHDOG_TIMEOUT_MS,
} from './schedule.js';

const POLL_INTERVAL_MS = 30_000;
const GIFT_CONFIG_TTL_MS = 10_000;
const VIEWER_COUNT_THROTTLE_MS = 5_000;

/**
 * Per-creator connection supervisor.
 *
 * A creator who asked Klaups to listen keeps a supervisor until they ask it to
 * stop. The supervisor owns the retry timer and the stale watchdog, so a room
 * that ends, a socket that dies silently, and a creator who simply isn't live
 * yet all funnel into the same place instead of racing each other.
 */
type Supervisor = {
  creator: ActiveCreator;
  conn: TikTokLiveConnection | null;
  techState: 'connecting' | 'connected' | 'waiting_live';
  consecutiveFailures: number;
  consecutiveWaits: number;
  connectedOnce: boolean;
  retryTimer: NodeJS.Timeout | null;
  watchdog: NodeJS.Timeout | null;
  lastViewerCountWrite: number;
};

const supervisors = new Map<string, Supervisor>();

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

/**
 * Builds a fresh connection and wires the event handlers.
 *
 * Every handler re-arms the stale watchdog first: a LIVE with no chat is not a
 * dead LIVE, so viewer-count pushes count as proof of life just as much as
 * messages do.
 */
function setupConnection(sup: Supervisor) {
  const creator = sup.creator;
  const connection = new TikTokLiveConnection(creator.tiktok_username, {
    fetchRoomInfoOnConnect: true,
  });
  sup.conn = connection;

  // Guards against a replaced connection still firing events into the app.
  const isStale = () => supervisors.get(creator.profile_id)?.conn !== connection;
  const alive = () => {
    if (isStale()) return false;
    armWatchdog(sup);
    return true;
  };

  connection.on(WebcastEvent.CHAT, async (data) => {
    if (!alive()) return;
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
    if (!alive()) return;
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
    // Re-arms the watchdog even when throttled below: TikTok pushes this
    // periodically in a silent room, making it our most reliable health signal.
    if (!alive()) return;
    const room = data as unknown as { viewerCount?: number; total?: number };
    const count = Number(room.viewerCount ?? room.total ?? 0);
    if (!Number.isFinite(count)) return;

    const now = Date.now();
    if (now - sup.lastViewerCountWrite < VIEWER_COUNT_THROTTLE_MS) return;
    sup.lastViewerCountWrite = now;

    await supabase
      .from('creator_settings')
      .update({ tiktok_viewer_count: count })
      .eq('profile_id', creator.profile_id);
    await send(creator.overlay_token, 'viewer_count', { count });
  });

  connection.on(ControlEvent.CONNECTED, (state) => {
    if (isStale()) return;
    console.log(`[${creator.tiktok_username}] connected, roomId=${state.roomId}`);
  });

  connection.on(ControlEvent.DISCONNECTED, ({ code, reason }) => {
    if (isStale()) return;
    console.log(`[${creator.tiktok_username}] disconnected (${code}) ${reason ?? ''}`);
    triggerRecovery(sup, reason || 'Stream ended');
  });

  connection.on(ControlEvent.ERROR, ({ info, exception }) => {
    if (isStale()) return;
    // A single error frame is not proof the room is gone: DISCONNECTED and the
    // stale watchdog cover real death. Log it and let those decide.
    console.error(`[${creator.tiktok_username}] error`, info, exception?.message);
  });

  return connection;
}

function armWatchdog(sup: Supervisor) {
  if (sup.watchdog) clearTimeout(sup.watchdog);
  sup.watchdog = setTimeout(() => {
    if (!supervisors.has(sup.creator.profile_id)) return;
    console.log(
      `[${sup.creator.tiktok_username}] no events for ${WATCHDOG_TIMEOUT_MS}ms; recovering`
    );
    triggerRecovery(sup, 'Connection went silent');
  }, WATCHDOG_TIMEOUT_MS);
}

function teardownConn(sup: Supervisor) {
  if (sup.watchdog) { clearTimeout(sup.watchdog); sup.watchdog = null; }
  const conn = sup.conn;
  sup.conn = null;
  if (!conn) return;
  conn.removeAllListeners();
  conn.disconnect().catch(() => {});
}

function teardownSupervisor(sup: Supervisor) {
  if (sup.retryTimer) { clearTimeout(sup.retryTimer); sup.retryTimer = null; }
  teardownConn(sup);
}

/** A live room we had, and lost. Only meaningful from the connected state. */
function triggerRecovery(sup: Supervisor, reason: string) {
  if (sup.techState !== 'connected') return;
  teardownConn(sup);
  sup.techState = 'connecting';
  void setStatus(sup.creator.profile_id, 'connecting', reason);
  void supabase
    .from('creator_settings')
    .update({ tiktok_viewer_count: 0 })
    .eq('profile_id', sup.creator.profile_id);
  scheduleAttempt(sup, 1_000);
}

function scheduleAttempt(sup: Supervisor, delayMs: number) {
  if (sup.retryTimer) clearTimeout(sup.retryTimer);
  sup.retryTimer = setTimeout(() => {
    runAttempt(sup).catch((err) => console.error('attempt failed', err));
  }, delayMs);
}

/**
 * One connection attempt, plus the state transition its result implies.
 *
 * The three outcomes are kept strictly apart. Telling a creator their stream is
 * offline when we simply failed to check is the single most confusing thing
 * this worker could do, so `unknown` never surfaces as "offline".
 */
async function runAttempt(sup: Supervisor) {
  if (!supervisors.has(sup.creator.profile_id)) return;

  const connection = setupConnection(sup);

  try {
    await connection.connect();
  } catch (err) {
    if (supervisors.get(sup.creator.profile_id)?.conn !== connection) return;
    const outcome = classifyAttempt(err);
    teardownConn(sup);

    if (outcome.kind === 'not_live') {
      const delay = nextWaitingLiveDelayMs(sup.consecutiveWaits);
      sup.consecutiveWaits += 1;
      sup.consecutiveFailures = 0;
      if (sup.techState !== 'waiting_live') {
        sup.techState = 'waiting_live';
        await setStatus(
          sup.creator.profile_id,
          'offline',
          'Not live right now — Klaups will connect the moment you go live'
        );
      }
      scheduleAttempt(sup, delay);
      return;
    }

    sup.consecutiveWaits = 0;
    sup.consecutiveFailures += 1;
    const delay = nextRetryDelayMs(sup.consecutiveFailures);
    console.log(
      `[${sup.creator.tiktok_username}] attempt failed (${outcome.message}); retrying in ${delay}ms`
    );
    // Stay on "connecting" until we have actually connected once. A creator
    // who just pressed the button should not watch the state flap.
    await setStatus(
      sup.creator.profile_id,
      'connecting',
      sup.connectedOnce ? 'Reconnecting to your LIVE…' : 'Joining your LIVE…'
    );
    scheduleAttempt(sup, delay);
    return;
  }

  if (supervisors.get(sup.creator.profile_id)?.conn !== connection) return;

  sup.techState = 'connected';
  sup.connectedOnce = true;
  sup.consecutiveFailures = 0;
  sup.consecutiveWaits = 0;
  armWatchdog(sup);
  await setStatus(sup.creator.profile_id, 'live', null);
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

/**
 * Start supervisors for creators who want Klaups listening, stop the rest.
 *
 * This only tracks *intent*. Retries and recovery are the supervisor's job, so
 * a creator waiting for their next LIVE is not re-attempted on this interval.
 */
async function reconcile() {
  const activeCreators = await fetchActiveCreators();
  const activeProfileIds = new Set(activeCreators.map((creator) => creator.profile_id));

  for (const [profileId, sup] of supervisors) {
    if (!activeProfileIds.has(profileId)) {
      supervisors.delete(profileId);
      teardownSupervisor(sup);
      giftConfigCache.delete(profileId);
      await setStatus(profileId, 'disconnected', null);
      await supabase
        .from('creator_settings')
        .update({ tiktok_viewer_count: 0 })
        .eq('profile_id', profileId);
    }
  }

  for (const creator of activeCreators) {
    const existing = supervisors.get(creator.profile_id);
    if (existing) {
      existing.creator = creator;
      continue;
    }

    const sup: Supervisor = {
      creator,
      conn: null,
      techState: 'connecting',
      consecutiveFailures: 0,
      consecutiveWaits: 0,
      connectedOnce: false,
      retryTimer: null,
      watchdog: null,
      lastViewerCountWrite: 0,
    };
    supervisors.set(creator.profile_id, sup);
    await setStatus(creator.profile_id, 'connecting', 'Joining your LIVE…');
    await runAttempt(sup);
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

process.on('SIGTERM', () => {
  for (const sup of supervisors.values()) teardownSupervisor(sup);
  process.exit(0);
});
