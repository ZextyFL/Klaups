'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { overlayTopic } from '@/lib/realtime';

// Subscribes to a creator's overlay broadcast topic and invokes `onEvent`
// for every named event received (donation, goal_update, chat_message,
// song_request). Used by all /overlay/* browser-source pages.
export function useOverlayChannel(
  overlayToken: string,
  events: string[],
  onEvent: (event: string, payload: unknown) => void
) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(overlayTopic(overlayToken), {
      config: { broadcast: { self: false } },
    });

    for (const event of events) {
      channel.on('broadcast', { event }, ({ payload }) => onEvent(event, payload));
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayToken]);
}
