'use client';

import { useRef, useState } from 'react';
import { useOverlayChannel } from '@/lib/use-overlay-channel';
import { useSpeechVoice } from '@/lib/use-speech-voice';

interface ChatMessagePayload {
  username: string;
  message: string;
  type: 'chat' | 'gift' | 'song_request';
}

interface SocialPayload {
  kind: 'like' | 'follow' | 'share' | 'join';
  username: string;
  count?: number;
}

// `entry` discriminates the wrapper; `kind` inside a social payload is the
// event type, so the two must not share a name.
type Line = { id: number } & (
  | ({ entry: 'message' } & ChatMessagePayload)
  | ({ entry: 'social' } & SocialPayload)
);

const MAX_LINES = 8;
// A chat burst must not turn into a minute of backlog: keep the queue short
// and drop the oldest so speech stays close to what's on screen.
const MAX_SPEECH_QUEUE = 6;
const MAX_SPEECH_CHARS = 200;

function socialText(p: SocialPayload) {
  switch (p.kind) {
    case 'like':
      return `+${(p.count ?? 1).toLocaleString()} likes`;
    case 'follow':
      return `${p.username} followed`;
    case 'share':
      return `${p.username} shared the LIVE`;
    case 'join':
      return `${p.username} joined`;
  }
}

const SOCIAL_ICON: Record<SocialPayload['kind'], string> = {
  like: '❤️',
  follow: '➕',
  share: '🔁',
  join: '👋',
};

export function ChatFeed({
  overlayToken,
  voiceName,
  language,
  speak = true,
  side = 'left',
}: {
  overlayToken: string;
  voiceName?: string | null;
  language?: string | null;
  speak?: boolean;
  side?: 'left' | 'right';
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const counter = useRef(0);
  const speechQueue = useRef<string[]>([]);
  const speaking = useRef(false);
  const voiceRef = useSpeechVoice(voiceName, language);

  function push(line: Omit<Line, 'id'>) {
    counter.current += 1;
    setLines((prev) => [...prev.slice(-(MAX_LINES - 1)), { ...line, id: counter.current } as Line]);
  }

  function enqueueSpeech(text: string) {
    if (!('speechSynthesis' in window)) return;
    const trimmed = text.length > MAX_SPEECH_CHARS ? `${text.slice(0, MAX_SPEECH_CHARS)}…` : text;
    speechQueue.current.push(trimmed);
    while (speechQueue.current.length > MAX_SPEECH_QUEUE) speechQueue.current.shift();
    if (!speaking.current) drainSpeechQueue();
  }

  function drainSpeechQueue() {
    const next = speechQueue.current.shift();
    if (!next) {
      speaking.current = false;
      return;
    }
    speaking.current = true;
    const utterance = new SpeechSynthesisUtterance(next);
    if (voiceRef.current) {
      utterance.voice = voiceRef.current;
      utterance.lang = voiceRef.current.lang;
    }
    utterance.onend = drainSpeechQueue;
    utterance.onerror = drainSpeechQueue;
    window.speechSynthesis.speak(utterance);
  }

  useOverlayChannel(overlayToken, ['chat_message', 'social'], (event, payload) => {
    if (event === 'chat_message') {
      const data = payload as ChatMessagePayload;
      push({ entry: 'message', ...data });
      // Gifts get their own alert with sound; song requests are announced by
      // the bot line itself. Only real chat is read aloud.
      if (speak && data.type === 'chat') enqueueSpeech(`${data.username} says ${data.message}`);
      return;
    }
    if (event === 'social') {
      const data = payload as SocialPayload;
      // Joins are frequent and low-signal; show them, never speak them.
      push({ entry: 'social', ...data });
      if (speak && data.kind === 'follow') enqueueSpeech(`${data.username} followed`);
    }
  });

  const isRight = side === 'right';

  return (
    <div
      className={`flex min-h-screen w-full flex-col justify-end gap-2 p-6 ${
        isRight ? 'items-end' : 'items-start'
      }`}
    >
      {lines.map((line) =>
        line.entry === 'social' ? (
          <div
            key={line.id}
            className={`w-fit max-w-xs rounded-full bg-black/45 px-3 py-1 text-sm text-white/80 shadow ${
              isRight ? 'text-right' : ''
            }`}
          >
            <span className="mr-1.5">{SOCIAL_ICON[line.kind]}</span>
            {socialText(line)}
          </div>
        ) : (
          <div
            key={line.id}
            className={`w-fit max-w-xs rounded-xl bg-black/60 px-4 py-2 text-white shadow ${
              isRight ? 'text-right' : ''
            } ${line.type === 'gift' ? 'ring-1 ring-brand-400/50' : ''}`}
          >
            <span className="font-semibold text-brand-400">{line.username}: </span>
            <span>{line.message}</span>
          </div>
        )
      )}
    </div>
  );
}
