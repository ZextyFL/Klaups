import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = createAdminClient();
  const { data: token } = await admin
    .from('tiktok_oauth_tokens')
    .select('access_token')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (token?.access_token) {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    if (clientKey && clientSecret) {
      const body = new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        token: token.access_token,
      });
      await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }).catch(() => {});
    }
  }

  await Promise.all([
    admin.from('tiktok_oauth_tokens').delete().eq('profile_id', user.id),
    admin.from('tiktok_connections').delete().eq('profile_id', user.id),
    admin.from('creator_settings').update({
      tiktok_verified: false,
      tiktok_verified_at: null,
      tiktok_worker_enabled: false,
      tiktok_status: 'disconnected',
      tiktok_status_message: null,
      updated_at: new Date().toISOString(),
    }).eq('profile_id', user.id),
  ]);

  return NextResponse.json({ ok: true });
}
