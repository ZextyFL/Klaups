import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function normalizeUsername(value: string) {
  return value
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '')
    .split(/[/?]/)[0]
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 64);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const username = normalizeUsername(String(body?.username ?? ''));
  if (!username) return NextResponse.json({ error: 'Enter your TikTok username.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from('tiktok_connections')
    .select('username')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: 'Verify your TikTok account first.' }, { status: 403 });
  }

  if (connection.username && connection.username.toLowerCase() !== username.toLowerCase()) {
    return NextResponse.json(
      { error: `Use the TikTok username verified by Login Kit: @${connection.username}` },
      { status: 400 }
    );
  }

  await admin.from('tiktok_connections').update({
    username,
    updated_at: new Date().toISOString(),
  }).eq('profile_id', user.id);

  await admin.from('creator_settings').update({
    tiktok_username: username,
    tiktok_worker_enabled: true,
    tiktok_status: 'connecting',
    tiktok_status_message: null,
    updated_at: new Date().toISOString(),
  }).eq('profile_id', user.id);

  return NextResponse.json({ ok: true, username });
}
