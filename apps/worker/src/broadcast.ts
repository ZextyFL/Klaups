import { supabase } from './supabase.js';

const SUBSCRIBE_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;

// The worker is long-running, so it keeps one realtime channel per active
// creator open while it is listening to their TikTok LIVE room.
const channels = new Map<string, ReturnType<typeof supabase.channel>>();

function topicFor(overlayToken: string) {
  return `klaups:${overlayToken}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getOrOpenChannel(overlayToken: string) {
  const topic = topicFor(overlayToken);
  const existing = channels.get(topic);
  if (existing) return existing;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const channel = supabase.channel(topic, { config: { broadcast: { ack: true } } });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Realtime subscription timed out')),
          SUBSCRIBE_TIMEOUT_MS,
        );

        channel.subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            resolve();
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            clearTimeout(timeout);
            reject(
              new Error(
                `Realtime channel status: ${status}${error ? ` - ${String(error)}` : ''}`,
              ),
            );
          }
        });
      });

      channels.set(topic, channel);
      return channel;
    } catch (error) {
      await supabase.removeChannel(channel).catch(() => undefined);
      if (attempt === MAX_ATTEMPTS) throw error;
      await wait(250 * attempt);
    }
  }

  throw new Error('Unable to open realtime channel');
}

export async function send(overlayToken: string, event: string, payload: unknown) {
  let channel = await getOrOpenChannel(overlayToken);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await channel.send({ type: 'broadcast', event, payload });
      if (result === 'ok') return;

      lastError = new Error(`Realtime broadcast returned: ${result}`);
    } catch (error) {
      lastError = error;
    }

    closeChannel(overlayToken);
    channel = await getOrOpenChannel(overlayToken);

    if (attempt < MAX_ATTEMPTS) await wait(250 * attempt);
  }

  throw lastError instanceof Error ? lastError : new Error('Realtime broadcast failed');
}

export function closeChannel(overlayToken: string) {
  const topic = topicFor(overlayToken);
  const channel = channels.get(topic);
  if (channel) {
    void supabase.removeChannel(channel);
    channels.delete(topic);
  }
}
