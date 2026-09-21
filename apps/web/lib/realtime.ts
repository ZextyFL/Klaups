import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Broadcasts an ephemeral event to everyone currently subscribed to a
// creator's overlay topic (OBS browser sources, worker, dashboard widgets).
// Nothing is persisted — this is push-only, so the overlay_token in the
// topic name never needs to double as a queryable RLS key.
export async function broadcast(topic: string, event: string, payload: unknown) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { params: { eventsPerSecond: 10 } } }
  );

  const channel = supabase.channel(topic);

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 4000); // never hang a webhook on realtime
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event, payload }).finally(() => {
          clearTimeout(timeout);
          resolve();
        });
      }
    });
  });

  await supabase.removeChannel(channel);
}

export function overlayTopic(overlayToken: string) {
  return `klaups:${overlayToken}`;
}
