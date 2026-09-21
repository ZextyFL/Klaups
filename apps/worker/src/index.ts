import 'dotenv/config';
import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { fetchActiveCreators, supabase, type ActiveCreator } from './supabase.js';
import { send } from './broadcast.js';
import { queueSongRequest } from './spotify.js';

const POLL_INTERVAL_MS = 30_000;

const connections = new Map<string, TikTokLiveConnection>();
const creatorByProfile = new Map<string, ActiveCreator>();

function displayName(user: { nickname?: string; uniqueId?: string } | undefined) {
  return user?.nickname || user?.uniqueId || 'Someone';
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
    const giftType = data.gift?.type;
    const isStreakInProgress = giftType === 1 && !data.repeatEnd;
    if (isStreakInProgress) return;

    const username = displayName(data.user);
    const giftName = data.gift?.name ?? 'a gift';
    await send(creator.overlay_token, 'chat_message', {
      username,
      message: `sent ${giftName} x${data.repeatCount ?? 1}!`,
      type: 'gift',
    });
  });

  connection.on(ControlEvent.CONNECTED, (state) => {
    console.log(`[${creator.tiktok_username}] connected, roomId=${state.roomId}`);
    void setStatus(creator.profile_id, 'live', `Connected to room ${state.roomId}`);
  });

  connection.on(ControlEvent.DISCONNECTED, ({ code, reason }) => {
    console.log(`[${creator.tiktok_username}] disconnected (${code}) ${reason ?? ''}`);
    connections.delete(creator.profile_id);
    void setStatus(creator.profile_id, 'offline', reason || 'Stream ended');
  });

  connection.on(ControlEvent.ERROR, ({ info, exception }) => {
    console.error(`[${creator.tiktok_username}] error`, info, exception?.message);
  });

  await setStatus(creator.profile_id, 'connecting', null);

  try {
    await connection.connect();
    connections.set(creator.profile_id, connection);
  } catch (err) {
    // Most commonly: the creator isn't live right now. We'll try again on
    // the next poll cycle instead of crashing the worker.
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
  const activeProfileIds = new Set(activeCreators.map((c) => c.profile_id));

  // Stop connections for creators who turned the worker off.
  for (const [profileId, connection] of connections) {
    if (!activeProfileIds.has(profileId)) {
      connection.disconnect().catch(() => {});
      connections.delete(profileId);
      creatorByProfile.delete(profileId);
      await setStatus(profileId, 'disconnected', null);
    }
  }

  // Start connections for newly enabled creators (or ones we lost).
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
