'use client';

import { useRef } from 'react';
import { useOverlayChannel } from '@/lib/use-overlay-channel';
import { playSoundUrl, type StopSound } from '@/lib/play-sound';

export function SoundboardOverlay({ overlayToken }: { overlayToken: string }) {
  const playing = useRef(new Set<StopSound>());

  useOverlayChannel(overlayToken, ['soundboard', 'soundboard_stop'], (event, payload) => {
    if (event === 'soundboard_stop') {
      for (const stop of playing.current) stop();
      playing.current.clear();
      return;
    }
    if (event !== 'soundboard') return;
    const sound = payload as { soundUrl?: string; volume?: number };
    const volume = Math.min(1, Math.max(0, Number(sound.volume ?? 100) / 100));
    let stop: StopSound | undefined;
    stop = playSoundUrl(sound.soundUrl, volume, () => {
      if (stop) playing.current.delete(stop);
    });
    if (stop) playing.current.add(stop);
  });

  return null;
}
