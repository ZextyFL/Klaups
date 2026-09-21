import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcast, overlayTopic } from '@/lib/realtime';

export const runtime = 'nodejs';

// Fires a fake chat message at the creator's own chat/TTS overlay so they
// can preview it (and hear the selected voice) without needing to actually
// be live. Nothing is persisted.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const message =
    typeof body?.message === 'string' && body.message.trim()
      ? body.message.trim().slice(0, 200)
      : 'This is a test message from Klaups!';
  const username = typeof body?.username === 'string' && body.username ? body.username : 'TestViewer';

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from('creator_settings')
    .select('overlay_token')
    .eq('profile_id', user.id)
    .single();

  if (!settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  await broadcast(overlayTopic(settings.overlay_token), 'chat_message', {
    username,
    message,
    type: 'chat',
  });

  return NextResponse.json({ ok: true });
}
