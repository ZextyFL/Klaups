import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchTikTokLiveStatus } from '@/lib/tiktok-public';

export const runtime = 'nodejs';

// "Connect TikTok LIVE" / "Stop listening".
//
// The worker can only join a room that exists, so rather than enabling it and
// letting the creator stare at "Connecting…" we check TikTok's public LIVE page
// first and say plainly that the stream is offline.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: settings } = await admin
    .from('creator_settings')
    .select('tiktok_username')
    .eq('profile_id', user.id)
    .maybeSingle();

  const username = settings?.tiktok_username;
  if (!username) {
    return NextResponse.json(
      { error: 'Add your TikTok username first.' },
      { status: 400 }
    );
  }

  if (body?.action === 'stop') {
    await admin
      .from('creator_settings')
      .update({
        tiktok_worker_enabled: false,
        tiktok_status: 'disconnected',
        tiktok_status_message: null,
        tiktok_viewer_count: 0,
        updated_at: now,
      })
      .eq('profile_id', user.id);

    return NextResponse.json({ ok: true, listening: false });
  }

  const status = await fetchTikTokLiveStatus(username);

  if (!status.live) {
    await admin
      .from('creator_settings')
      .update({
        tiktok_worker_enabled: false,
        tiktok_status: 'offline',
        tiktok_status_message: 'TikTok LIVE stream is offline.',
        tiktok_live_checked_at: now,
        updated_at: now,
      })
      .eq('profile_id', user.id);

    // Mirrors the wording streamers already know from comparable tools, so the
    // failure reads as an expected state rather than a bug in Klaups.
    return NextResponse.json(
      {
        offline: true,
        username,
        title: `Unable to connect to your TikTok channel @${username}`,
        body: [
          `Unable to connect to your TikTok channel @${username} because your TikTok LIVE stream is currently offline!`,
          'Please start your stream and click the connect button again.',
          'Note that you can also set up Klaups while you are offline.',
          'If you have any questions, please contact support.',
        ],
        details:
          status.reason === 'not_found'
            ? `We couldn't find @${username} on TikTok`
            : status.reason === 'unknown'
              ? "Couldn't reach TikTok — try again in a moment"
              : 'LIVE has ended',
      },
      { status: 409 }
    );
  }

  await admin
    .from('creator_settings')
    .update({
      tiktok_worker_enabled: true,
      tiktok_status: 'connecting',
      tiktok_status_message: 'LIVE detected — joining your room…',
      tiktok_viewer_count: status.viewerCount ?? 0,
      tiktok_live_checked_at: now,
      tiktok_live_title: status.title,
      updated_at: now,
    })
    .eq('profile_id', user.id);

  return NextResponse.json({
    ok: true,
    listening: true,
    username,
    viewerCount: status.viewerCount,
    title: status.title,
  });
}
