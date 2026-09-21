'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOverlayChannel } from '@/lib/use-overlay-channel';
import { useSpeechVoice } from '@/lib/use-speech-voice';
import { formatCents } from '@/lib/format';
import { playSoundUrl } from '@/lib/play-sound';

interface DonationPayload {
  donorName: string;
  message: string | null;
  amountCents: number;
  currency: string;
  soundUrl: string | null;
  imageUrl: string | null;
  displaySeconds: number;
  messageTemplate: string;
  preset?: 'clean' | 'hype' | 'neon' | 'minimal';
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
    setQueue((items) => [...items, { ...(payload as DonationPayload), id: counter.current }]);
  });

  const playNext = useCallback(() => {
    setQueue((items) => {
      if (items.length === 0) {
        setCurrent(null);
        return items;
      }

      const [next, ...rest] = items;
      setCurrent(next);
      playSoundUrl(next.soundUrl);

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

  const preset = current.preset ?? 'clean';

  const panelClass =
    preset === 'hype'
      ? 'border-orange-300/35 bg-gradient-to-br from-orange-500/85 via-red-500/80 to-fuchsia-600/80 shadow-[0_0_70px_rgba(249,115,22,0.35)]'
      : preset === 'neon'
        ? 'border-fuchsia-300/35 bg-black/75 shadow-[0_0_55px_rgba(217,70,239,0.45)]'
        : preset === 'minimal'
          ? 'border-white/10 bg-black/70 shadow-xl'
          : 'border-white/15 bg-black/80 shadow-[0_20px_70px_rgba(0,0,0,0.5)]';

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-[32px] border px-7 py-7 text-white backdrop-blur-xl ${panelClass} animate-[klaupsAlertIn_0.45s_cubic-bezier(.2,.8,.2,1)]`}
      >
        {preset === 'neon' && (
          <>
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300 to-transparent" />
            <div className="pointer-events-none absolute -left-14 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-fuchsia-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -right-14 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-indigo-500/30 blur-3xl" />
          </>
        )}

        {current.imageUrl ? (
          <img
            src={current.imageUrl}
            alt=""
            className="mx-auto mb-5 max-h-48 max-w-full object-contain animate-[klaupsMediaIn_0.5s_ease-out]"
          />
        ) : (
          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black ${
              preset === 'hype'
                ? 'bg-white/20'
                : preset === 'neon'
                  ? 'border border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-200'
                  : 'bg-white/[0.08]'
            }`}
          >
            ♥
          </div>
        )}

        <p
          className={`font-bold tracking-tight ${
            preset === 'minimal' ? 'text-2xl' : 'text-3xl sm:text-4xl'
          }`}
        >
          {text}
        </p>

        {current.message && (
          <p
            className={`mx-auto mt-3 max-w-xl leading-6 ${
              preset === 'hype' ? 'text-white/90' : 'text-white/70'
            }`}
          >
            “{current.message}”
          </p>
        )}

        {preset !== 'minimal' && (
          <div className="mx-auto mt-5 h-1 w-16 rounded-full bg-white/30" />
        )}
      </div>

      <style jsx global>{`
        @keyframes klaupsAlertIn {
          0% {
            transform: translateY(18px) scale(0.92);
            opacity: 0;
          }
          65% {
            transform: translateY(-3px) scale(1.015);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes klaupsMediaIn {
          0% {
            transform: scale(0.7) rotate(-3deg);
            opacity: 0;
          }
          100% {
            transform: scale(1) rotate(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
