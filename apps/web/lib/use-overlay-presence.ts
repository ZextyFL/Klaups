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
    channel.subscribe();
    const read = () => setOverlays(readOverlayPresence(channel.presenceState() as Record<string, unknown[]>));
    channel.on('presence', { event: 'sync' }, read);
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
