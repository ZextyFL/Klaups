import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWorkerHealth } from '@/lib/worker-health';
import { createLiveSession } from '@/lib/live-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Euler JWTs are capped at 2h; the overlay refetches before each reconnect.
const JWT_TTL_SECONDS = 2 * 60 * 60;

/**
 * Hands the elected overlay connector what it needs to open the creator's
 * TikTok LIVE WebSocket: a Euler Stream JWT that only works for this
 * creator's @username (so it's safe in a browser source), plus a signed
 * session for /api/live/ingest. The Euler API key never leaves the server.
 */
export async function GET(request: Request) {
  const overlayToken = new URL(request.url).searchParams.get('token') ?? '';
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(overlayToken)) {
    return NextResponse.json({ mode: 'invalid' }, { status: 400 });
  }

  const { data: settings } = await createAdminClient()
    .from('creator_settings')
    .select('profile_id, tiktok_username, tiktok_worker_enabled, song_request_enabled, song_request_command')
    .eq('overlay_token', overlayToken)
    .maybeSingle();

  if (!settings) return NextResponse.json({ mode: 'invalid' }, { status: 404 });
  // Not listening: the creator hasn't pressed "Connect TikTok LIVE".
  if (!settings.tiktok_worker_enabled || !settings.tiktok_username) {
    return NextResponse.json({ mode: 'idle' });
  }
  // A server worker is running and will handle this room; don't double-connect.
  if ((await getWorkerHealth()).online) return NextResponse.json({ mode: 'worker' });

  const apiKey = process.env.EULER_API_KEY?.trim();
  const accountId = process.env.EULER_ACCOUNT_ID?.trim();
  if (!apiKey || !accountId) return NextResponse.json({ mode: 'unconfigured' });

  const response = await fetch(
    `https://api.eulerstream.com/accounts/${encodeURIComponent(accountId)}/jwt/create`,
    {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: `klaups:${settings.profile_id}`,
        expireAfter: JWT_TTL_SECONDS,
        metadata: { version: 'v1', expireAfter: JWT_TTL_SECONDS },
        api: { enabled: false },
        // The whole point: this token can open sockets for this creator only.
        websockets: {
          enabled: true,
          config: { allowedCreators: [settings.tiktok_username], maxWebSockets: 2 },
        },
      }),
      cache: 'no-store',
    }
  ).catch(() => null);

  const body = (await response?.json().catch(() => null)) as { token?: string; message?: string } | null;
  if (!response?.ok || !body?.token) {
    console.error('euler jwt create failed', response?.status, body?.message);
    return NextResponse.json({ mode: 'error', message: body?.message ?? 'Could not get a TikTok LIVE token' }, { status: 502 });
  }

  const wsUrl =
    'wss://ws.eulerstream.com?' +
    new URLSearchParams({
      uniqueId: settings.tiktok_username,
      jwtKey: body.token,
      'features.bundleEvents': '1',
      'features.rawMessages': '0',
      'features.schemaVersion': 'v2',
    }).toString();

  return NextResponse.json(
    {
      mode: 'browser',
      wsUrl,
      username: settings.tiktok_username,
      session: createLiveSession(settings.profile_id, JWT_TTL_SECONDS),
      songRequestCommand: settings.song_request_enabled ? settings.song_request_command : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
