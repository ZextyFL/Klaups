import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const MAX_ATTEMPTS = 3;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Server-side broadcasts use Realtime's HTTP endpoint so the API does not
// need to open a WebSocket subscription before sending an alert.
export async function broadcast(topic: string, event: string, payload: unknown) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { params: { eventsPerSecond: 10 } } }
  );

  const channel = supabase.channel(topic);
  let lastError: unknown;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await channel.httpSend(event, payload);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS) await wait(250 * attempt);
      }
    }
  } finally {
    await supabase.removeChannel(channel).catch(() => undefined);
  }

  throw lastError instanceof Error ? lastError : new Error('Realtime broadcast failed');
}

export function overlayTopic(overlayToken: string) {
  return `klaups:${overlayToken}`;
}
