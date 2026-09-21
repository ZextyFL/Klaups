import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Looks up a TikTok user's public nickname + avatar by username, by reading
// the same embedded JSON blob TikTok's own profile page hydrates from.
// No login/API key involved — this is public profile data, the same info
// anyone sees visiting tiktok.com/@username. Used to show a "is this you?"
// confirmation card before we save the connection, since there's no OAuth
// consent screen available without a gated TikTok Developer app (see the
// dashboard note next to the Connect button).
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const username = new URL(request.url).searchParams.get('username')?.replace(/^@/, '').trim();
  if (!username || !/^[a-zA-Z0-9._]{1,24}$/.test(username)) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Could not reach TikTok' }, { status: 502 });
    }

    const html = await res.text();
    const match = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!match) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const data = JSON.parse(match[1]);
    const detail = data?.__DEFAULT_SCOPE__?.['webapp.user-detail'];
    const tiktokUser = detail?.userInfo?.user;

    if (!tiktokUser || detail?.statusCode) {
      return NextResponse.json({ error: 'TikTok account not found' }, { status: 404 });
    }

    return NextResponse.json({
      username: tiktokUser.uniqueId ?? username,
      nickname: tiktokUser.nickname || tiktokUser.uniqueId || username,
      avatarUrl: tiktokUser.avatarLarger || tiktokUser.avatarMedium || tiktokUser.avatarThumb || null,
      verified: Boolean(tiktokUser.verified),
    });
  } catch (err) {
    console.error('tiktok lookup failed', err);
    return NextResponse.json({ error: 'Lookup failed, try again' }, { status: 502 });
  }
}
