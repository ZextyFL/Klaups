'use client';

import { useEffect, useRef, useState } from 'react';
import { getAudioState, unlockAudio } from '@/lib/play-sound';
import {
  getOverlayChannel,
  getPresenceKey,
  readOverlayPresence,
  type AudioState,
  type ConnectorPresenceState,
  type OverlayKind,
} from '@/lib/overlay-channel';
import { LiveConnector } from '@/lib/live-connector';

const SETTLE_MS = 3_000; // let presence sync before electing, to avoid two leaders
const TICK_MS = 5_000;

/**
 * Mounted once in every overlay page. It:
 *  1. reports the overlay to the dashboard (which overlay, audio state, host),
 *  2. elects one overlay per creator — the oldest open one — to hold the
 *     TikTok LIVE connection, and runs it there (so three browser sources
 *     don't open three connections),
 *  3. shows a tiny "click to enable sound" chip only if the host blocks audio.
 */
export function OverlayRuntime({ overlayToken, kind }: { overlayToken: string; kind: OverlayKind }) {
  const [audio, setAudio] = useState<AudioState>('running');
  const connectorState = useRef<{ state: ConnectorPresenceState; detail?: string }>({ state: 'standby' });

  useEffect(() => {
    const channel = getOverlayChannel(overlayToken);
    channel.subscribe();
    const myKey = getPresenceKey(overlayToken);
    const since = Date.now();
    const host = 'obsstudio' in window ? 'obs' : 'other';
    let lastTracked = '';

    const track = (force = false) => {
      const state = getAudioState();
      setAudio(state);
      if (channel.state !== 'joined') return;
      const payload = {
        kind,
        audio: state,
        host,
        since,
        connector: connectorState.current.state,
        detail: connectorState.current.detail,
      };
      const serialized = JSON.stringify(payload);
      if (!force && serialized === lastTracked) return;
      lastTracked = serialized;
      void channel.track(payload);
    };

    const connector = new LiveConnector(
      overlayToken,
      (event, payload) => void channel.send({ type: 'broadcast', event, payload }),
      (state, detail) => {
        connectorState.current = { state, detail };
        track();
      }
    );
    let leading = false;

    const elect = () => {
      const overlays = readOverlayPresence(channel.presenceState() as Record<string, unknown[]>);
      if (!overlays.some((o) => o.key === myKey)) return; // our own presence isn't visible yet
      const leader = overlays.sort((a, b) => a.since - b.since || a.key.localeCompare(b.key))[0];
      const shouldLead = leader?.key === myKey;
      if (shouldLead && !leading) {
        leading = true;
        connector.start();
      } else if (!shouldLead && leading) {
        leading = false;
        connector.stop();
        connectorState.current = { state: 'standby' };
        track();
      }
    };

    void unlockAudio().then(setAudio);
    const onGesture = () => void unlockAudio().then(() => track());
    const onHide = () => {
      if (leading) connector.reportClosed();
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    window.addEventListener('pagehide', onHide);

    const first = window.setTimeout(() => track(true), 800);
    const settle = window.setTimeout(elect, SETTLE_MS);
    const tick = window.setInterval(() => {
      track();
      elect();
    }, TICK_MS);
    // Re-publish periodically so the dashboard sees fresh audio state even if
    // nothing changed and presence was dropped by a reconnect.
    const refresh = window.setInterval(() => track(true), 30_000);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(settle);
      window.clearInterval(tick);
      window.clearInterval(refresh);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('pagehide', onHide);
      connector.stop();
      void channel.untrack();
    };
  }, [overlayToken, kind]);

  if (audio !== 'suspended') return null;

  return (
    <button
      type="button"
      onClick={() => void unlockAudio().then(setAudio)}
      className="pointer-events-auto fixed bottom-3 right-3 z-50 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/20"
    >
      🔇 Click once to enable Klaups sound
    </button>
  );
}
