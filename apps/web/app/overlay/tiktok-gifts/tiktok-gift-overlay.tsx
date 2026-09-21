'use client';

import { useEffect, useRef, useState } from 'react';
import { useOverlayChannel } from '@/lib/use-overlay-channel';
import { playSoundUrl } from '@/lib/play-sound';

type GiftPayload = {
  giftId: string;
  giftName: string;
  giftImageUrl: string | null;
  diamondCount: number | null;
  repeatCount: number;
  senderName: string;
  senderUniqueId: string | null;
  soundUrl: string | null;
  volume: number;
  displaySeconds: number;
  showVisual: boolean;
  showSender: boolean;
  showGiftImage: boolean;
  messageTemplate: string;
};

type QueueItem = GiftPayload & { queueId: number };

export function TikTokGiftOverlay({ overlayToken }: { overlayToken: string }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const counter = useRef(0);

  useOverlayChannel(overlayToken, ['tiktok_gift'], (event, payload) => {
    if (event !== 'tiktok_gift') return;
    counter.current += 1;
    setQueue((items) => [...items, { ...(payload as GiftPayload), queueId: counter.current }]);
  });

  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, queue]);

  useEffect(() => {
    if (!current) return;

    const duration = Math.min(60, Math.max(1, Number(current.displaySeconds) || 5));
    const stop = playSoundUrl(current.soundUrl, Math.min(1, Math.max(0, Number(current.volume) / 100)));

    const timer = window.setTimeout(() => {
      stop?.();
      setCurrent(null);
    }, duration * 1000);

    return () => {
      window.clearTimeout(timer);
      stop?.();
    };
  }, [current]);

  if (!current) return null;

  const message = current.messageTemplate
    .replace('{name}', current.senderName)
    .replace('{gift}', current.giftName)
    .replace('{count}', String(current.repeatCount));

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-5 text-center">
      {current.showVisual && (
        <div className="relative max-w-xl animate-[giftPop_.45s_cubic-bezier(.2,.9,.2,1)] text-white">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/15 blur-3xl" />

          {current.showGiftImage && current.giftImageUrl && (
            <img
              src={current.giftImageUrl}
              alt=""
              className="relative mx-auto mb-3 h-28 w-28 object-contain drop-shadow-[0_12px_25px_rgba(0,0,0,0.65)]"
            />
          )}

          <p className="relative text-3xl font-black tracking-tight [text-shadow:0_3px_12px_rgba(0,0,0,0.95)]">
            {current.showSender ? message : `${current.giftName} ×${current.repeatCount}`}
          </p>

          {current.diamondCount !== null && (
            <p className="relative mt-2 text-sm font-semibold text-cyan-200 [text-shadow:0_2px_8px_rgba(0,0,0,0.95)]">
              ◆ {(current.diamondCount * current.repeatCount).toLocaleString()} diamonds
            </p>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes giftPop {
          0% { opacity: 0; transform: translateY(24px) scale(.72) rotate(-2deg); }
          65% { opacity: 1; transform: translateY(-5px) scale(1.05) rotate(1deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
        }
      `}</style>
    </div>
  );
}
