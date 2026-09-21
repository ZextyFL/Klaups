import { supabase } from './supabase.js';

// The worker is a long-running process, so — unlike the webhook, which opens
// a fresh connection per call — it keeps one realtime channel per active
// creator open for as long as it's listening to their TikTok LIVE room.
const channels = new Map<string, ReturnType<typeof supabase.channel>>();

function topicFor(overlayToken: string) {
  return `klaups:${overlayToken}`;
}

export async function getOrOpenChannel(overlayToken: string) {
  const topic = topicFor(overlayToken);
  let channel = channels.get(topic);
  if (channel) return channel;

  channel = supabase.channel(topic);
  await new Promise<void>((resolve) => {
    channel!.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
    });
  });
  channels.set(topic, channel);
  return channel;
}

export async function send(overlayToken: string, event: string, payload: unknown) {
  const channel = await getOrOpenChannel(overlayToken);
  await channel.send({ type: 'broadcast', event, payload });
}

export function closeChannel(overlayToken: string) {
  const topic = topicFor(overlayToken);
  const channel = channels.get(topic);
  if (channel) {
    supabase.removeChannel(channel);
    channels.delete(topic);
  }
}
