'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOverlayChannel } from '@/lib/use-overlay-channel';
import { useSpeechVoice } from '@/lib/use-speech-voice';
import { formatCents } from '@/lib/format';

interface DonationPayload {
  donorName: string;
  message: string | null;
  amountCents: number;
  currency: string;
  soundUrl: string | null;
  imageUrl: string | null;
  displaySeconds: number;
  messageTemplate: string;
  speak: string | null;
}

interface QueueItem extends DonationPayload {
  id: number;
}

export function AlertPopup({
  overlayToken,
  voiceName,
  language,
}: {
  overlayToken: string;
  voiceName?: string | null;
  language?: string | null;
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const voiceRef = useSpeechVoice(voiceName, language);

  useOverlayChannel(overlayToken, ['donation'], (event, payload) => {
    if (event !== 'donation') return;
    counter.current += 1;
    setQueue((q) => [...q, { ...(payload as DonationPayload), id: counter.current }]);
  });

  const playNext = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) {
        setCurrent(null);
        return q;
      }
      const [next, ...rest] = q;
      setCurrent(next);

      if (next.soundUrl) {
        const audio = new Audio(next.soundUrl);
        audio.play().catch(() => {});
      }
      if (next.speak && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(next.speak);
        if (voiceRef.current) {
          utterance.voice = voiceRef.current;
          utterance.lang = voiceRef.current.lang;
        }
        window.speechSynthesis.speak(utterance);
      }

      timeoutRef.current = setTimeout(playNext, next.displaySeconds * 1000);
      return rest;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) playNext();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [queue, current, playNext]);

  if (!current) return null;

  const text = current.messageTemplate
    .replace('{name}', current.donorName)
    .replace('{amount}', formatCents(current.amountCents, current.currency));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      {current.imageUrl && (
        <img
          src={current.imageUrl}
          alt=""
          className="max-h-64 max-w-full animate-[pop_0.4s_ease-out]"
        />
      )}
      <p className="rounded-xl bg-black/70 px-6 py-3 text-2xl font-bold text-white shadow-lg">
        {text}
      </p>
      {current.message && (
        <p className="max-w-md rounded-lg bg-black/50 px-4 py-2 text-white/90">{current.message}</p>
      )}
      <style jsx global>{`
        @keyframes pop {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
