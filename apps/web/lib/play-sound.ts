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

// Builtins are synthesized and all finish well inside this window.
const BUILTIN_DURATION_MS = 1400;

export function playBuiltinSound(
  name: BuiltinSound | string,
  volume = 1,
  onEnded?: () => void
): StopSound | undefined {
  if (typeof window === 'undefined') return;

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const now = context.currentTime + 0.01;
  const level = Math.min(1, Math.max(0, volume));
  let stopped = false;

  switch (name) {
    case 'cash':
      tone(context, 880, now, 0.12, 'square', 0.1 * level);
      tone(context, 1320, now + 0.11, 0.12, 'square', 0.08 * level);
      tone(context, 1760, now + 0.22, 0.16, 'sine', 0.08 * level);
      break;
    case 'hype':
      tone(context, 320, now, 0.18, 'sawtooth', 0.08 * level);
      tone(context, 440, now + 0.12, 0.18, 'sawtooth', 0.08 * level);
      tone(context, 660, now + 0.24, 0.28, 'square', 0.08 * level);
      break;
    case 'airhorn':
      tone(context, 220, now, 0.5, 'sawtooth', 0.09 * level);
      tone(context, 277, now, 0.5, 'square', 0.07 * level);
      tone(context, 330, now + 0.08, 0.42, 'sawtooth', 0.06 * level);
      break;
    case 'applause':
      for (let i = 0; i < 9; i += 1) {
        tone(context, 420 + i * 37, now + i * 0.045, 0.1, 'triangle', 0.035 * level);
      }
      break;
    case 'chime':
    default:
      tone(context, 659.25, now, 0.22, 'sine', 0.09 * level);
      tone(context, 783.99, now + 0.12, 0.25, 'sine', 0.08 * level);
      tone(context, 987.77, now + 0.26, 0.35, 'sine', 0.07 * level);
      break;
  }

  const closeTimer = window.setTimeout(() => {
    if (stopped) return;
    stopped = true;
    void context.close().catch(() => {});
    onEnded?.();
  }, BUILTIN_DURATION_MS);

  return () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(closeTimer);
    void context.close().catch(() => {});
  };
}

/**
 * Plays a builtin (`builtin:name`) or a URL. `onEnded` fires once when the
 * sound finishes naturally or fails to play — never after an explicit stop —
 * so callers can hold an alert on screen for exactly as long as its audio.
 */
export function playSoundUrl(
  soundUrl: string | null | undefined,
  volume = 1,
  onEnded?: () => void
): StopSound | undefined {
  if (!soundUrl || typeof window === 'undefined') {
    onEnded?.();
    return;
  }

  if (soundUrl.startsWith('builtin:')) {
    return playBuiltinSound(soundUrl.slice('builtin:'.length), volume, onEnded);
  }

  const audio = new Audio(soundUrl);
  let stopped = false;
  let ended = false;
  audio.volume = Math.min(1, Math.max(0, volume));

  const finish = () => {
    if (stopped || ended) return;
    ended = true;
    onEnded?.();
  };
  audio.addEventListener('ended', finish);
  audio.addEventListener('error', finish);

  // Autoplay can be refused (e.g. a tab that hasn't been interacted with);
  // treat that as "finished" so nothing waits on a sound that never starts.
  audio.play().catch(finish);

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
