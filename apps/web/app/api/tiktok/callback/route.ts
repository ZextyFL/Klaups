import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';

type TikTokTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const error = requestUrl.searchParams.get('error');
  const cookieHeader = request.headers.get('cookie') ?? '';
  const expectedState = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('klaups_tiktok_oauth_state='))
    ?.split('=')
    .slice(1)
    .join('=');

  if (error) {
    return NextResponse.redirect(
      `${siteUrl()}/onboarding/tiktok?error=${encodeURIComponent('TikTok authorization was cancelled or denied.')}`
    );
  }

  if (!code || !state || !expectedState || state !== decodeURIComponent(expectedState)) {
    return NextResponse.redirect(
      `${siteUrl()}/onboarding/tiktok?error=${encodeURIComponent('TikTok authorization state is invalid or expired.')}`
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl()}/login`);
  }

  // Trimmed for the same reason as the authorize step: a stray newline on
  // either value makes TikTok fail the token exchange.
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(
      `${siteUrl()}/onboarding/tiktok?error=${encodeURIComponent('TikTok Login Kit credentials are missing.')}`
    );
  }

  const redirectUri = `${siteUrl()}/api/tiktok/callback`;
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body,
    cache: 'no-store',
  });

  const token = (await tokenResponse.json()) as TikTokTokenResponse;
  if (!tokenResponse.ok || !token.access_token || !token.open_id) {
    const message = token.error_description || token.error || 'TikTok token exchange failed.';
    return NextResponse.redirect(
      `${siteUrl()}/onboarding/tiktok?error=${encodeURIComponent(message)}`
    );
  }

  const grantedScopes = new Set((token.scope ?? '').split(',').filter(Boolean));
  const fields = ['open_id', 'union_id', 'avatar_url', 'display_name'];
  if (grantedScopes.has('user.info.profile')) {
    fields.push('username', 'profile_deep_link');
  }

  const userInfoResponse = await fetch(
    `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields.join(','))}`,
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store',
    }
  );

  const userInfoJson = await userInfoResponse.json() as {
    data?: { user?: Record<string, unknown> };
    error?: { code?: string; message?: string };
  };
  const profile = userInfoJson.data?.user ?? {};

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('tiktok_connections')
    .select('profile_id')
    .eq('open_id', token.open_id)
    .maybeSingle();

  if (existing && existing.profile_id !== user.id) {
    return NextResponse.redirect(
      `${siteUrl()}/onboarding/tiktok?error=${encodeURIComponent('This TikTok account is already connected to another Klaups creator.')}`
    );
  }

  const username = typeof profile.username === 'string' ? profile.username.replace(/^@/, '') : null;
  const displayName = typeof profile.display_name === 'string' ? profile.display_name : null;
  const avatarUrl = typeof profile.avatar_url === 'string' ? profile.avatar_url : null;
  const unionId = typeof profile.union_id === 'string' ? profile.union_id : null;
  const profileDeepLink = typeof profile.profile_deep_link === 'string' ? profile.profile_deep_link : null;

  const now = new Date();
  await admin.from('tiktok_connections').upsert({
    profile_id: user.id,
    open_id: token.open_id,
    union_id: unionId,
    username,
    display_name: displayName,
    avatar_url: avatarUrl,
    profile_deep_link: profileDeepLink,
    updated_at: now.toISOString(),
  }, { onConflict: 'profile_id' });

  await admin.from('tiktok_oauth_tokens').upsert({
    profile_id: user.id,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    scope: token.scope ?? null,
    token_type: token.token_type ?? 'Bearer',
    expires_at: token.expires_in ? new Date(now.getTime() + token.expires_in * 1000).toISOString() : null,
    refresh_expires_at: token.refresh_expires_in
      ? new Date(now.getTime() + token.refresh_expires_in * 1000).toISOString()
      : null,
    updated_at: now.toISOString(),
  }, { onConflict: 'profile_id' });

  await admin.from('creator_settings').update({
    tiktok_verified: true,
    tiktok_verified_at: now.toISOString(),
    tiktok_username: username,
    tiktok_display_name: displayName,
    tiktok_avatar_url: avatarUrl,
    tiktok_worker_enabled: Boolean(username),
    tiktok_status: username ? 'connecting' : 'disconnected',
    tiktok_status_message: username
      ? null
      : 'TikTok identity verified. Add your LIVE username to finish setup.',
    updated_at: now.toISOString(),
  }).eq('profile_id', user.id);

  const response = NextResponse.redirect(`${siteUrl()}/onboarding/tiktok?connected=1`);
  response.cookies.set('klaups_tiktok_oauth_state', '', { maxAge: 0, path: '/' });
  return response;
}
