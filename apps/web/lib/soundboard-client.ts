'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { overlayTopic } from '@/lib/realtime';
import { playSoundUrl, type StopSound } from '@/lib/play-sound';

export type PlayableSound = {
  id: string;
  name: string;
  sound_url: string;
  volume?: number | null;
};

// ---------------------------------------------------------------------------
// One broadcast channel per overlay topic, shared by every sender on the page.
//
// Sending straight from the browser is what makes hotkeys feel instant: the
// old path was browser -> Netlify function -> fresh realtime connection ->
// subscribe -> send -> teardown, a second or more per press (and a cold start
// on the first). Realtime returns the same channel object for the same topic,
// so a ref count keeps one hotkey listener from closing another's channel.
// ---------------------------------------------------------------------------

const shared = new Map<string, { channel: RealtimeChannel; refs: number }>();

function acquire(overlayToken: string) {
  const topic = overlayTopic(overlayToken);
  const existing = shared.get(topic);
  if (existing) {
    existing.refs += 1;
    return existing.channel;
  }
  const supabase = createClient();
  const channel = supabase.channel(topic, { config: { broadcast: { self: false } } });
  channel.subscribe();
  shared.set(topic, { channel, refs: 1 });
  return channel;
}

function release(overlayToken: string) {
  const topic = overlayTopic(overlayToken);
  const entry = shared.get(topic);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  shared.delete(topic);
  void createClient().removeChannel(entry.channel);
}

// ---------------------------------------------------------------------------
// "Hear it here too": play locally in the dashboard as well as on stream.
// Without this, pressing a hotkey with the OBS source closed was silent and
// looked broken. Per-browser preference, defaulting on.
// ---------------------------------------------------------------------------

const MONITOR_KEY = 'klaups:soundboard:monitor';
export const MONITOR_CHANGED_EVENT = 'klaups:soundboard-monitor';

export function readMonitor(): boolean {
  try {
    return window.localStorage.getItem(MONITOR_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeMonitor(on: boolean) {
  try {
    window.localStorage.setItem(MONITOR_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode / blocked storage: the toggle just won't persist.
  }
  window.dispatchEvent(new CustomEvent(MONITOR_CHANGED_EVENT, { detail: on }));
}

export const SOUND_PLAYED_EVENT = 'klaups:soundboard-played';

// Local playback is page-global so "Stop all" also silences sounds started by
// the layout-level hotkey listener.
const localStops = new Set<StopSound>();

function stopLocal() {
  for (const stop of localStops) stop();
  localStops.clear();
}

export function useSoundboardPlayer(overlayToken: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    channelRef.current = acquire(overlayToken);
    return () => {
      channelRef.current = null;
      release(overlayToken);
    };
  }, [overlayToken]);

  const send = useCallback(
    async (event: string, payload: Record<string, unknown>) => {
      const channel = channelRef.current;
      if (channel) {
        // realtime-js falls back to its REST broadcast endpoint when the
        // socket isn't joined yet, so a press right after page load still lands.
        const result = await channel.send({ type: 'broadcast', event, payload }).catch(() => 'error');
        if (result === 'ok') return true;
      }
      return false;
    },
    []
  );

  const play = useCallback(
    async (sound: PlayableSound) => {
      const volume = Math.min(1, Math.max(0, Number(sound.volume ?? 100) / 100));

      if (readMonitor()) {
        let stop: StopSound | undefined;
        stop = playSoundUrl(sound.sound_url, volume, () => {
          if (stop) localStops.delete(stop);
        });
        if (stop) localStops.add(stop);
      }

      window.dispatchEvent(new CustomEvent(SOUND_PLAYED_EVENT, { detail: sound.id }));

      const sent = await send('soundboard', {
        id: sound.id,
        name: sound.name,
        soundUrl: sound.sound_url,
        volume: Number(sound.volume ?? 100),
      });
      if (sent) return;

      // Last resort: the server route, which authenticates and broadcasts.
      const response = await fetch('/api/soundboard/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soundId: sound.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Could not play sound on stream');
      }
    },
    [send]
  );

  const stopAll = useCallback(async () => {
    stopLocal();
    await send('soundboard_stop', {});
  }, [send]);

  return { play, stopAll };
}
