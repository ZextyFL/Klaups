'use client';

import { useEffect, useState } from 'react';
import { getOverlayChannel, readOverlayPresence, type OverlayPresence } from '@/lib/overlay-channel';

/**
 * Live list of the creator's open overlays (OBS / LIVE Studio sources), read
 * from realtime presence. `ready` flips after a short settle so the UI doesn't
 * flash "no overlay open" before the first presence sync arrives.
 */
export function useOverlayPresence(overlayToken: string) {
  const [overlays, setOverlays] = useState<(OverlayPresence & { key: string })[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const channel = getOverlayChannel(overlayToken);
    // The channel is shared and usually already subscribed (the dashboard's
    // soundboard opens it first), and realtime-js throws if presence
    // callbacks are added after subscribe(). Presence is enabled in the
    // channel config, so polling presenceState() is enough — no listener.
    channel.subscribe();
    const read = () => {
      try {
        setOverlays(readOverlayPresence(channel.presenceState() as Record<string, unknown[]>));
      } catch {
        // A status widget must never take the page down.
      }
    };
    read();
    const poll = window.setInterval(read, 2_000);
    const settle = window.setTimeout(() => setReady(true), 4_000);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(settle);
    };
  }, [overlayToken]);

  return { overlays, ready };
}
