import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchTikTokProfile, isValidUsername, normalizeUsername } from '@/lib/tiktok-public';

export const runtime = 'nodejs';

// Powers the "is this you?" confirmation card: public profile data only, the
// same thing anyone sees visiting tiktok.com/@username.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const username = normalizeUsername(new URL(request.url).searchParams.get('username') ?? '');
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'Enter a valid TikTok username.' }, { status: 400 });
  }

  const profile = await fetchTikTokProfile(username);
  if (!profile) {
    return NextResponse.json({ error: `We couldn't find @${username} on TikTok.` }, { status: 404 });
  }

  return NextResponse.json({
    username: profile.username,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
    verified: profile.verified,
    liveNow: Boolean(profile.roomId),
  });
}
