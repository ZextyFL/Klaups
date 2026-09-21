import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';


export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = request.headers.get('cookie')?.match(/spotify_oauth_state=([^;]+)/)?.[1];

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(`${siteUrl()}/dashboard/integrations?spotify=error`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl()}/login`);
  }

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString(
          'base64'
        ),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${siteUrl()}/api/spotify/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${siteUrl()}/dashboard/integrations?spotify=error`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };

  const meRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const me = meRes.ok ? ((await meRes.json()) as { id: string }) : null;

  await supabase.from('spotify_tokens').upsert({
    profile_id: user.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    spotify_user_id: me?.id ?? null,
    updated_at: new Date().toISOString(),
  });

  const response = NextResponse.redirect(`${siteUrl()}/dashboard/integrations?spotify=connected`);
  response.cookies.delete('spotify_oauth_state');
  return response;
}
