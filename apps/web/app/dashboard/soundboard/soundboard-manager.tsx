'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AUDIO_ACCEPT, prepareAudioUpload } from '@/lib/audio-upload';
import {
  comboFromEvent,
  comboLabel,
  isModifierOnly,
  isReserved,
  KEYBIND_RECORDING_EVENT,
  SOUNDBOARD_CHANGED_EVENT,
} from '@/lib/keybind';
import {
  MONITOR_CHANGED_EVENT,
  readMonitor,
  SOUND_PLAYED_EVENT,
  useSoundboardPlayer,
  writeMonitor,
} from '@/lib/soundboard-client';
import type { SoundboardSound } from '@/lib/database.types';

const STARTER_SOUNDS = [
  { name: 'Airhorn', sound_url: 'builtin:airhorn', keybind: 'Digit1', sort_order: 1 },
  { name: 'Cash', sound_url: 'builtin:cash', keybind: 'Digit2', sort_order: 2 },
  { name: 'Hype', sound_url: 'builtin:hype', keybind: 'Digit3', sort_order: 3 },
  { name: 'Applause', sound_url: 'builtin:applause', keybind: 'Digit4', sort_order: 4 },
  { name: 'Chime', sound_url: 'builtin:chime', keybind: 'Digit5', sort_order: 5 },
];

// Shortcuts the browser keeps for itself — the page never receives them, so
// binding one would silently never fire.
function browserOwned(combo: string) {
  const parts = combo.split('+');
  const code = parts[parts.length - 1];
  const hasCmd = parts.includes('Ctrl') || parts.includes('Meta');
  if (hasCmd && ['KeyW', 'KeyT', 'KeyN', 'KeyQ', 'Tab'].includes(code)) return true;
  return ['F11', 'F12'].includes(code);
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
        checked ? 'border-brand-400/40 bg-brand-500' : 'border-white/10 bg-white/[0.08]'
      }`}
    >
      <span
        className={`absolute top-0.5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-[3px]'}`}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}

export function SoundboardManager({
  profileId,
  overlayToken,
  sounds,
}: {
  profileId: string;
  overlayToken: string;
  sounds: SoundboardSound[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const { play, stopAll } = useSoundboardPlayer(overlayToken);

  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordHint, setRecordHint] = useState<string | null>(null);
  const [monitor, setMonitor] = useState(true);
  const [volumeDrafts, setVolumeDrafts] = useState<Record<string, number>>({});

  useEffect(() => {
    setMonitor(readMonitor());
    const onMonitor = (e: Event) => setMonitor(Boolean((e as CustomEvent<boolean>).detail));
    // Light up the card whichever way the sound was triggered — button or hotkey.
    let clear: number | undefined;
    const onPlayed = (e: Event) => {
      setFlash((e as CustomEvent<string>).detail);
      window.clearTimeout(clear);
      clear = window.setTimeout(() => setFlash(null), 350);
    };
    window.addEventListener(MONITOR_CHANGED_EVENT, onMonitor);
    window.addEventListener(SOUND_PLAYED_EVENT, onPlayed);
    return () => {
      window.removeEventListener(MONITOR_CHANGED_EVENT, onMonitor);
      window.removeEventListener(SOUND_PLAYED_EVENT, onPlayed);
      window.clearTimeout(clear);
    };
  }, []);

  function changed() {
    // Tell the layout-level hotkey listener to reload bindings.
    window.dispatchEvent(new Event(SOUNDBOARD_CHANGED_EVENT));
    router.refresh();
  }

  async function updateSound(id: string, patch: Partial<SoundboardSound>) {
    setBusy(id);
    setError(null);
    const { error: updateError } = await supabase
      .from('soundboard_sounds')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('profile_id', profileId);
    setBusy(null);
    if (updateError) setError(updateError.message);
    else changed();
  }

  // ---------------------------------------------------------------- recorder
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(KEYBIND_RECORDING_EVENT, { detail: Boolean(recordingId) }));
    if (!recordingId) return;

    const sound = sounds.find((s) => s.id === recordingId);

    function onKeyDown(event: KeyboardEvent) {
      // Capture phase + stopPropagation: the key being recorded must never
      // also trigger whatever it is currently bound to.
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat || isModifierOnly(event)) return;

      const plain = !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
      if (plain && event.code === 'Escape') {
        setRecordingId(null);
        setRecordHint(null);
        return;
      }
      if (plain && (event.code === 'Backspace' || event.code === 'Delete')) {
        setRecordingId(null);
        setRecordHint(null);
        void updateSound(recordingId!, { keybind: null });
        return;
      }
      if (isReserved(event)) {
        setRecordHint(`${event.code} can't be used — press another key.`);
        return;
      }

      const combo = comboFromEvent(event);
      if (browserOwned(combo)) {
        setRecordHint(`${comboLabel(combo)} is reserved by your browser — press another key.`);
        return;
      }
      const clash = sounds.find((s) => s.id !== recordingId && s.keybind === combo);
      if (clash) {
        setRecordHint(`${comboLabel(combo)} is already used by “${clash.name}” — press another key.`);
        return;
      }

      setRecordingId(null);
      setRecordHint(null);
      if (combo !== sound?.keybind) void updateSound(recordingId!, { keybind: combo });
    }

    // Clicking anywhere else cancels, like every other key-capture UI.
    function onPointerDown(event: PointerEvent) {
      const el = event.target as HTMLElement | null;
      if (el?.closest('[data-keybind-recorder]')) return;
      setRecordingId(null);
      setRecordHint(null);
    }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId, sounds]);

  useEffect(
    () => () => {
      window.dispatchEvent(new CustomEvent(KEYBIND_RECORDING_EVENT, { detail: false }));
    },
    []
  );

  // ----------------------------------------------------------------- actions
  async function trigger(sound: SoundboardSound) {
    setError(null);
    try {
      await play(sound);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not play sound');
    }
  }

  async function installStarterPack() {
    setBusy('starter');
    setError(null);
    const usedKeys = new Set(sounds.map((sound) => sound.keybind).filter(Boolean));
    const rows = STARTER_SOUNDS.filter(
      (preset) => !sounds.some((sound) => sound.sound_url === preset.sound_url)
    ).map((preset) => ({
      ...preset,
      profile_id: profileId,
      keybind: usedKeys.has(preset.keybind) ? null : preset.keybind,
    }));

    if (!rows.length) {
      setBusy(null);
      return;
    }
    const { error: insertError } = await supabase.from('soundboard_sounds').insert(rows);
    setBusy(null);
    if (insertError) setError(insertError.message);
    else changed();
  }

  async function uploadSound(file: File) {
    const prepared = prepareAudioUpload(file);
    if (!prepared.ok) {
      setError(prepared.error);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }

    setBusy('upload');
    setError(null);
    try {
      const path = `${profileId}/${crypto.randomUUID()}.${prepared.extension}`;
      const { error: uploadError } = await supabase.storage
        .from('soundboard')
        .upload(path, file, { contentType: prepared.contentType, cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('soundboard').getPublicUrl(path);
      const { error: insertError } = await supabase.from('soundboard_sounds').insert({
        profile_id: profileId,
        name: name.trim() || file.name.replace(/\.[^/.]+$/, '').slice(0, 40),
        sound_url: data.publicUrl,
        sort_order: sounds.length + 1,
      });
      if (insertError) throw insertError;

      setName('');
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function removeSound(id: string) {
    setBusy(id);
    const { error: deleteError } = await supabase
      .from('soundboard_sounds')
      .delete()
      .eq('id', id)
      .eq('profile_id', profileId);
    setBusy(null);
    if (deleteError) setError(deleteError.message);
    else changed();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="card rounded-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Your sounds</h2>
            <p className="mt-1 text-sm text-white/40">
              Hotkeys work on every Klaups dashboard page while its tab is focused.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/60">
              <Switch
                checked={monitor}
                label="Hear sounds in the dashboard too"
                onChange={(next) => writeMonitor(next)}
              />
              Hear it here too
            </label>
            <button type="button" className="btn-secondary text-sm" onClick={() => void stopAll()}>
              ■ Stop all
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={installStarterPack}
              disabled={busy === 'starter'}
            >
              {busy === 'starter' ? 'Adding…' : 'Add starter sounds'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {sounds.map((sound) => {
            const isRecording = recordingId === sound.id;
            const volume = volumeDrafts[sound.id] ?? sound.volume ?? 100;

            return (
              <div
                key={sound.id}
                className={`rounded-2xl border p-4 transition ${
                  flash === sound.id
                    ? 'border-brand-400/60 bg-brand-500/10'
                    : 'border-white/[0.08] bg-white/[0.025]'
                } ${sound.enabled ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <input
                    className="min-w-0 flex-1 truncate bg-transparent font-medium outline-none focus:underline"
                    defaultValue={sound.name}
                    aria-label="Sound name"
                    onBlur={(e) => {
                      const next = e.target.value.trim().slice(0, 40);
                      if (next && next !== sound.name) void updateSound(sound.id, { name: next });
                      else e.target.value = sound.name;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <Switch
                    checked={sound.enabled}
                    label={`${sound.name} enabled`}
                    onChange={(enabled) => void updateSound(sound.id, { enabled })}
                  />
                </div>
                <p className="mt-1 text-xs text-white/35">
                  {sound.sound_url.startsWith('builtin:') ? 'Klaups preset' : 'Custom upload'}
                </p>

                <button
                  type="button"
                  className="mt-4 flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                  onClick={() => void trigger(sound)}
                  disabled={!sound.enabled}
                >
                  <span>▶ Play</span>
                  <span className="rounded-md bg-black/10 px-2 py-1 text-xs">{comboLabel(sound.keybind)}</span>
                </button>

                <div className="mt-3" data-keybind-recorder>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordHint(null);
                      setRecordingId(isRecording ? null : sound.id);
                    }}
                    disabled={busy === sound.id}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                      isRecording
                        ? 'animate-pulse border-brand-400/60 bg-brand-500/15 text-white'
                        : 'border-white/[0.08] bg-white/[0.03] text-white/65 hover:text-white'
                    }`}
                  >
                    <span>{isRecording ? 'Press any key…' : 'Keybind'}</span>
                    <kbd className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-xs">
                      {isRecording ? '…' : comboLabel(sound.keybind)}
                    </kbd>
                  </button>
                  {isRecording && (
                    <p className="mt-1.5 text-xs leading-5 text-white/40">
                      {recordHint ?? 'Ctrl / Alt / Shift combos work. Esc cancels, ⌫ clears.'}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className="w-8 text-xs text-white/40">🔊</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={volume}
                    aria-label={`${sound.name} volume`}
                    className="flex-1 accent-pink-500"
                    onChange={(e) =>
                      setVolumeDrafts((d) => ({ ...d, [sound.id]: Number(e.target.value) }))
                    }
                    onPointerUp={(e) =>
                      void updateSound(sound.id, { volume: Number((e.target as HTMLInputElement).value) })
                    }
                    onKeyUp={(e) =>
                      void updateSound(sound.id, { volume: Number((e.target as HTMLInputElement).value) })
                    }
                  />
                  <span className="w-9 text-right text-xs tabular-nums text-white/45">{volume}%</span>
                </div>

                <button
                  type="button"
                  className="mt-3 text-xs text-red-300/80 hover:text-red-300"
                  disabled={busy === sound.id}
                  onClick={() => removeSound(sound.id)}
                >
                  Remove
                </button>
              </div>
            );
          })}

          {sounds.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center">
              <p className="font-medium">Your soundboard is empty</p>
              <p className="mt-1 text-sm text-white/40">
                Add the Klaups starter pack or upload your own sounds.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card h-fit rounded-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-400">Custom sound</p>
        <h2 className="mt-2 text-xl font-semibold">Upload a sound</h2>
        <p className="mt-2 text-sm text-white/45">MP3, WAV, OGG, M4A, AAC, WEBM or FLAC · up to 15 MB.</p>

        <div className="mt-5">
          <label className="label">Sound name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Let's go!"
          />
        </div>

        <button
          type="button"
          className="btn-accent mt-4 w-full"
          onClick={() => fileInput.current?.click()}
          disabled={busy === 'upload'}
        >
          {busy === 'upload' ? 'Uploading…' : 'Choose audio file'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={AUDIO_ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadSound(e.target.files[0])}
        />

        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-xs leading-5 text-white/45">
          <p className="font-medium text-white/70">Setting a keybind</p>
          <p className="mt-1">
            Click <span className="text-white/70">Keybind</span> on a sound, then press the key or
            combo you want (e.g. <kbd className="font-mono">Ctrl + 1</kbd>).
          </p>
        </div>
      </div>
    </div>
  );
}
