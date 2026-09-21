import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { broadcast, overlayTopic } from '@/lib/realtime';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const soundId = typeof body?.soundId === 'string' ? body.soundId : '';

  if (!soundId) {
    return NextResponse.json({ error: 'Missing sound' }, { status: 400 });
  }

  const admin = createAdminClient();

  const [{ data: settings }, { data: sound }] = await Promise.all([
    admin
      .from('creator_settings')
      .select('overlay_token')
      .eq('profile_id', user.id)
      .single(),
    admin
      .from('soundboard_sounds')
      .select('id, profile_id, name, sound_url, enabled')
      .eq('id', soundId)
      .eq('profile_id', user.id)
      .single(),
  ]);

  if (!settings || !sound || !sound.enabled) {
    return NextResponse.json({ error: 'Sound not found or disabled' }, { status: 404 });
  }

  await broadcast(overlayTopic(settings.overlay_token), 'soundboard', {
    id: sound.id,
    name: sound.name,
    soundUrl: sound.sound_url,
  });

  return NextResponse.json({ ok: true });
}
