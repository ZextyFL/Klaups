import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';

const SCOPES = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing'];


export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl()}/login`);
  }

  const state = randomUUID();
  const authorizeUrl = new URL('https://accounts.spotify.com/authorize');
  authorizeUrl.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID!);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', `${siteUrl()}/api/spotify/callback`);
  authorizeUrl.searchParams.set('scope', SCOPES.join(' '));
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set('spotify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    maxAge: 600,
    path: '/',
  });
  return response;
}
