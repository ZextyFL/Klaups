import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchTikTokProfile, isValidUsername, normalizeUsername } from '@/lib/tiktok-public';

export const runtime = 'nodejs';

// Links a TikTok account to the signed-in Klaups creator by username.
//
// Login Kit is no longer required to reach this endpoint. Google secures the
// Klaups account; the creator names the TikTok they stream on and confirms the
// public profile card we show them. If a Login Kit connection does exist it
// still wins, because that one is cryptographically proven.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const username = normalizeUsername(String(body?.username ?? ''));
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'Enter your TikTok username.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from('tiktok_connections')
    .select('username, link_method')
    .eq('profile_id', user.id)
    .maybeSingle();

  // A Login Kit link is proof of ownership, so it may not be overridden by
  // simply typing a different handle.
  if (
    connection?.link_method === 'login_kit' &&
    connection.username &&
    connection.username.toLowerCase() !== username.toLowerCase()
  ) {
    return NextResponse.json(
      { error: `Use the TikTok username verified by Login Kit: @${connection.username}` },
      { status: 400 }
    );
  }

  const profile = await fetchTikTokProfile(username);
  if (!profile) {
    return NextResponse.json(
      { error: `We couldn't find @${username} on TikTok. Check the spelling and try again.` },
      { status: 404 }
    );
  }

  // Don't let two Klaups creators claim the same TikTok handle.
  const { data: claimedBy } = await admin
    .from('tiktok_connections')
    .select('profile_id')
    .ilike('username', profile.username)
    .neq('profile_id', user.id)
    .maybeSingle();

  if (claimedBy) {
    return NextResponse.json(
      { error: 'That TikTok account is already connected to another Klaups creator.' },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  const { error: upsertError } = await admin.from('tiktok_connections').upsert(
    {
      profile_id: user.id,
      username: profile.username,
      display_name: profile.nickname,
      avatar_url: profile.avatarUrl,
      link_method: connection?.link_method === 'login_kit' ? 'login_kit' : 'username',
      updated_at: now,
    },
    { onConflict: 'profile_id' }
  );

  if (upsertError) {
    // The partial unique index on lower(username) is the authoritative guard
    // against a race the SELECT above cannot close.
    return NextResponse.json(
      { error: 'That TikTok account is already connected to another Klaups creator.' },
      { status: 409 }
    );
  }

  await admin
    .from('creator_settings')
    .update({
      tiktok_verified: true,
      tiktok_verified_at: now,
      tiktok_username: profile.username,
      tiktok_display_name: profile.nickname,
      tiktok_avatar_url: profile.avatarUrl,
      // Linking alone does not start the worker: the creator presses
      // "Connect TikTok LIVE" when they are actually broadcasting.
      tiktok_worker_enabled: false,
      tiktok_status: 'disconnected',
      tiktok_status_message: null,
      updated_at: now,
    })
    .eq('profile_id', user.id);

  return NextResponse.json({
    ok: true,
    username: profile.username,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
  });
}
