import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const popup = url.searchParams.get('popup') === '1';

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const providers = Array.isArray(data.user.app_metadata?.providers)
        ? data.user.app_metadata.providers
        : [data.user.app_metadata?.provider].filter(Boolean);

      if (!providers.includes('google')) {
        await supabase.auth.signOut();
        const message = 'Klaups only supports Google sign in.';
        return NextResponse.redirect(
          popup
            ? `${siteUrl()}/auth/popup-complete?ok=0&error=${encodeURIComponent(message)}`
            : `${siteUrl()}/login?error=${encodeURIComponent(message)}`
        );
      }

      return NextResponse.redirect(
        popup
          ? `${siteUrl()}/auth/popup-complete?ok=1`
          : `${siteUrl()}/onboarding/tiktok`
      );
    }
  }

  const message = 'Google sign in is invalid or expired.';
  return NextResponse.redirect(
    popup
      ? `${siteUrl()}/auth/popup-complete?ok=0&error=${encodeURIComponent(message)}`
      : `${siteUrl()}/login?error=${encodeURIComponent(message)}`
  );
}
