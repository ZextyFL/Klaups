'use client';

type BuiltinSound = 'chime' | 'cash' | 'hype' | 'airhorn' | 'applause';
export type StopSound = () => void;

function tone(
  context: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainValue = 0.14
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export function playBuiltinSound(name: BuiltinSound | string): StopSound | undefined {
  if (typeof window === 'undefined') return;

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const now = context.currentTime + 0.01;
  let stopped = false;

  switch (name) {
    case 'cash':
      tone(context, 880, now, 0.12, 'square', 0.1);
      tone(context, 1320, now + 0.11, 0.12, 'square', 0.08);
      tone(context, 1760, now + 0.22, 0.16, 'sine', 0.08);
      break;
    case 'hype':
      tone(context, 320, now, 0.18, 'sawtooth', 0.08);
      tone(context, 440, now + 0.12, 0.18, 'sawtooth', 0.08);
      tone(context, 660, now + 0.24, 0.28, 'square', 0.08);
      break;
    case 'airhorn':
      tone(context, 220, now, 0.5, 'sawtooth', 0.09);
      tone(context, 277, now, 0.5, 'square', 0.07);
      tone(context, 330, now + 0.08, 0.42, 'sawtooth', 0.06);
      break;
    case 'applause':
      for (let i = 0; i < 9; i += 1) {
        tone(context, 420 + i * 37, now + i * 0.045, 0.1, 'triangle', 0.035);
      }
      break;
    case 'chime':
    default:
      tone(context, 659.25, now, 0.22, 'sine', 0.09);
      tone(context, 783.99, now + 0.12, 0.25, 'sine', 0.08);
      tone(context, 987.77, now + 0.26, 0.35, 'sine', 0.07);
      break;
  }

  const closeTimer = window.setTimeout(() => {
    if (stopped) return;
    stopped = true;
    void context.close().catch(() => {});
  }, 1400);

  return () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(closeTimer);
    void context.close().catch(() => {});
  };
}

export function playSoundUrl(
  soundUrl: string | null | undefined
): StopSound | undefined {
  if (!soundUrl || typeof window === 'undefined') return;

  if (soundUrl.startsWith('builtin:')) {
    return playBuiltinSound(soundUrl.slice('builtin:'.length));
  }

  const audio = new Audio(soundUrl);
  let stopped = false;

  audio.play().catch(() => {});

  return () => {
    if (stopped) return;
    stopped = true;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Some streams do not allow seeking. Pausing is enough.
    }
    audio.src = '';
    audio.load();
  };
}
