import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl()}/login`);
  }

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [user.app_metadata?.provider].filter(Boolean);

  if (!providers.includes('google')) {
    return NextResponse.redirect(`${siteUrl()}/login?error=Google+sign+in+required`);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return NextResponse.redirect(
      `${siteUrl()}/onboarding/tiktok?error=${encodeURIComponent('TikTok Login Kit is not configured yet.')}`
    );
  }

  const state = crypto.randomUUID();
  const redirectUri = `${siteUrl()}/api/tiktok/callback`;
  const scopes = process.env.TIKTOK_PROFILE_SCOPE_ENABLED === 'true'
    ? 'user.info.basic,user.info.profile'
    : 'user.info.basic';

  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', clientKey);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set('klaups_tiktok_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
    path: '/',
  });
  return response;
}
