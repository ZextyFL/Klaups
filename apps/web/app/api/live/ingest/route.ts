import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyLiveSession } from '@/lib/live-session';
import { resolveEvent, resolveGift, type Broadcast } from '@/lib/live-alerts';
import { queueSongRequest } from '@/lib/spotify-queue';

export const runtime = 'nodejs';

type IngestEvent =
  | { kind: 'status'; status: 'live' | 'offline' | 'connecting' | 'error'; message?: string | null; viewers?: number }
  | {
      kind: 'gift';
      giftId: string;
      giftName: string;
      imageUrl: string | null;
      diamondCount: number | null;
      repeatCount: number;
      senderName: string;
      senderUniqueId: string | null;
    }
  | { kind: 'follow' | 'share'; senderName: string; senderUniqueId: string | null }
  | { kind: 'song_request'; username: string; query: string };

const str = (value: unknown, max: number) => String(value ?? '').slice(0, max);

/**
 * The browser connector sends the events that need server work — gift
 * bookkeeping + alert config, song requests, status — and gets back the
 * realtime broadcasts to play, which it sends on its already-open channel
 * for the lowest possible latency.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const profileId = verifyLiveSession(body?.session);
  if (!profileId) return NextResponse.json({ error: 'invalid session' }, { status: 401 });

  const events: IngestEvent[] = Array.isArray(body?.events) ? body.events.slice(0, 25) : [];
  const broadcasts: Broadcast[] = [];
  const admin = createAdminClient();

  for (const event of events) {
    if (event?.kind === 'status') {
      const status = ['live', 'offline', 'connecting', 'error'].includes(event.status) ? event.status : 'error';
      const patch: Record<string, unknown> = {
        tiktok_status: status,
        tiktok_status_message: event.message ? str(event.message, 200) : null,
      };
      if (status === 'live') patch.tiktok_last_seen_at = new Date().toISOString();
      if (typeof event.viewers === 'number' && Number.isFinite(event.viewers)) {
        patch.tiktok_viewer_count = Math.max(0, Math.round(event.viewers));
      }
      if (status !== 'live') patch.tiktok_viewer_count = 0;
      await admin.from('creator_settings').update(patch).eq('profile_id', profileId);
    } else if (event?.kind === 'gift') {
      broadcasts.push(
        ...(await resolveGift(profileId, {
          giftId: str(event.giftId, 64),
          giftName: str(event.giftName, 80) || 'Gift',
          imageUrl: event.imageUrl ? str(event.imageUrl, 1000) : null,
          diamondCount: Number.isFinite(Number(event.diamondCount)) ? Number(event.diamondCount) : null,
          repeatCount: Math.min(10_000, Math.max(1, Math.round(Number(event.repeatCount) || 1))),
          senderName: str(event.senderName, 80) || 'Someone',
          senderUniqueId: event.senderUniqueId ? str(event.senderUniqueId, 80) : null,
        }))
      );
    } else if (event?.kind === 'follow' || event?.kind === 'share') {
      broadcasts.push(
        ...(await resolveEvent(
          profileId,
          event.kind === 'follow' ? 'event:follow' : 'event:share',
          str(event.senderName, 80) || 'Someone',
          event.senderUniqueId ? str(event.senderUniqueId, 80) : null
        ))
      );
    } else if (event?.kind === 'song_request') {
      const requestedBy = str(event.username, 80) || 'Viewer';
      const query = str(event.query, 200).trim();
      if (!query) continue;
      const result = await queueSongRequest(profileId, query);
      await admin.from('song_requests').insert({
        profile_id: profileId,
        requested_by: requestedBy,
        query,
        track_uri: result.trackUri ?? null,
        track_name: result.trackName ?? null,
        artist_name: result.artistName ?? null,
        status: result.status,
      });
      broadcasts.push({
        event: 'chat_message',
        payload: {
          username: 'Klaups',
          type: 'song_request',
          message:
            result.status === 'queued'
              ? `Queued "${result.trackName}" by ${result.artistName} for ${requestedBy}!`
              : result.status === 'no_match'
                ? `Couldn't find a track for "${query}".`
                : `Couldn't queue "${query}" — make sure Spotify is open.`,
        },
      });
      if (result.status === 'queued') {
        broadcasts.push({
          event: 'song_request',
          payload: { requestedBy, trackName: result.trackName, artistName: result.artistName },
        });
      }
    }
  }

  return NextResponse.json({ broadcasts });
}
