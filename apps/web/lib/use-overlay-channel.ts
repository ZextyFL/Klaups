'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getOverlayChannel } from '@/lib/overlay-channel';

// Subscribes to a creator's overlay broadcast topic and keeps the channel
// alive so alerts continue working after temporary realtime disconnects.
export function useOverlayChannel(
  overlayToken: string,
  events: string[],
  onEvent: (event: string, payload: unknown) => void
) {
  useEffect(() => {
    const supabase = createClient();
    const channel = getOverlayChannel(overlayToken);
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    for (const event of events) {
      channel.on('broadcast', { event }, ({ payload }) => onEvent(event, payload));
    }

    const subscribe = () => {
      if (!disposed) channel.subscribe();
    };

    channel.subscribe((status) => {
      if (disposed) return;

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(subscribe, 750);
      }
    });

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayToken]);
}
