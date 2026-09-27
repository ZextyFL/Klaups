import { createHmac, timingSafeEqual } from 'node:crypto';

// Short-lived capability the browser connector presents to /api/live/ingest.
// Signed with a key derived from the service role key (already a server-only
// secret), so no new env var is needed and it can't be minted client-side.

type Session = { p: string; e: number };

function key() {
  return `klaups-live-session:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`;
}

function sign(body: string) {
  return createHmac('sha256', key()).update(body).digest('base64url');
}

export function createLiveSession(profileId: string, ttlSeconds: number) {
  const body = Buffer.from(JSON.stringify({ p: profileId, e: Math.floor(Date.now() / 1000) + ttlSeconds } satisfies Session)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Returns the profile id for a valid, unexpired session, else null. */
export function verifyLiveSession(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const session = JSON.parse(Buffer.from(body, 'base64url').toString()) as Session;
    if (typeof session.p !== 'string' || session.e < Math.floor(Date.now() / 1000)) return null;
    return session.p;
  } catch {
    return null;
  }
}
