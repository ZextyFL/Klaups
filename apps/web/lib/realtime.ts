import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const SUBSCRIBE_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Sends an ephemeral realtime event and only reports success when Supabase
// confirms both the channel subscription and the broadcast send.
export async function broadcast(topic: string, event: string, payload: unknown) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { params: { eventsPerSecond: 10 } } }
  );

  let lastError = 'Realtime broadcast failed';

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const channel = supabase.channel(topic);

      try {
        const sendResult = await new Promise<string>((resolve, reject) => {
          let settled = false;

          const timeout = setTimeout(() => {
            if (!settled) {
              settled = true;
              reject(new Error('Realtime subscription timed out'));
            }
          }, SUBSCRIBE_TIMEOUT_MS);

          channel.subscribe((status) => {
            if (settled) return;

            if (status === 'SUBSCRIBED') {
              void channel
                .send({ type: 'broadcast', event, payload })
                .then((result) => {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timeout);

                  if (result === 'ok') {
                    resolve('ok');
                  } else {
                    reject(new Error(`Realtime broadcast returned: ${result}`));
                  }
                })
                .catch((error) => {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timeout);
                  reject(error instanceof Error ? error : new Error(String(error)));
                });
              return;
            }

            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              settled = true;
              clearTimeout(timeout);
              reject(new Error(`Realtime channel status: ${status}`));
            }
          });
        });

        if (sendResult === 'ok') return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      } finally {
        await supabase.removeChannel(channel).catch(() => undefined);
      }

      if (attempt < MAX_ATTEMPTS) {
        await wait(250 * attempt);
      }
    }
  } finally {
    await supabase.removeAllChannels().catch(() => undefined);
  }

  throw new Error(lastError);
}

export function overlayTopic(overlayToken: string) {
  return `klaups:${overlayToken}`;
}
