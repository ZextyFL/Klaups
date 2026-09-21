'use client';

import { useEffect, useRef, useState } from 'react';
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
  volume?: number;
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
  const counter = useRef(0);
  const voiceRef = useSpeechVoice(voiceName, language);

  useOverlayChannel(overlayToken, ['donation'], (event, payload) => {
    if (event !== 'donation') return;
    counter.current += 1;
    setQueue((items) => [...items, { ...(payload as DonationPayload), id: counter.current }]);
  });

  // Pull the next alert from the queue only when nothing is currently showing.
  useEffect(() => {
    if (current || queue.length === 0) return;

    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, queue]);

  // Own the alert lifetime in one effect. This prevents re-renders from
  // accidentally cancelling the dismissal timer.
  useEffect(() => {
    if (!current) return;

    const seconds = Number.isFinite(Number(current.displaySeconds))
      ? Math.min(60, Math.max(1, Number(current.displaySeconds)))
      : 6;
    const durationMs = seconds * 1000;

    const stopSound = playSoundUrl(current.soundUrl, Math.min(1, Math.max(0, Number(current.volume ?? 100) / 100)));

    if (current.speak && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(current.speak);
      if (voiceRef.current) {
        utterance.voice = voiceRef.current;
        utterance.lang = voiceRef.current.lang;
      }
      window.speechSynthesis.speak(utterance);
    }

    const timer = window.setTimeout(() => {
      stopSound?.();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setCurrent(null);
    }, durationMs);

    return () => {
      window.clearTimeout(timer);
      stopSound?.();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [current, voiceRef]);

  if (!current) return null;

  const text = current.messageTemplate
    .replace('{name}', current.donorName)
    .replace('{amount}', formatCents(current.amountCents, current.currency));

  const preset = current.preset ?? 'clean';

  const panelClass =
    preset === 'hype'
      ? 'drop-shadow-[0_12px_35px_rgba(249,115,22,0.45)]'
      : preset === 'neon'
        ? 'drop-shadow-[0_12px_35px_rgba(217,70,239,0.5)]'
        : preset === 'minimal'
          ? 'drop-shadow-[0_8px_22px_rgba(0,0,0,0.75)]'
          : 'drop-shadow-[0_10px_28px_rgba(0,0,0,0.75)]';

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div
        className={`relative w-full max-w-2xl px-7 py-7 text-white ${panelClass} animate-[klaupsAlertIn_0.45s_cubic-bezier(.2,.8,.2,1)]`}
      >
        {preset === 'neon' && (
          <>
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/20 blur-3xl" />
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
                ? 'bg-orange-500/20 ring-1 ring-orange-200/30'
                : preset === 'neon'
                  ? 'bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-300/30'
                  : 'bg-white/10 ring-1 ring-white/15'
            }`}
          >
            ♥
          </div>
        )}

        <p
          className={`font-bold tracking-tight [text-shadow:0_3px_12px_rgba(0,0,0,0.95)] ${
            preset === 'minimal' ? 'text-2xl' : 'text-3xl sm:text-4xl'
          }`}
        >
          {text}
        </p>

        {current.message && (
          <p
            className={`mx-auto mt-3 max-w-xl leading-6 ${
              preset === 'hype'
                ? 'text-white/95 [text-shadow:0_2px_8px_rgba(0,0,0,0.95)]'
                : 'text-white/80 [text-shadow:0_2px_8px_rgba(0,0,0,0.95)]'
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
