'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { playSoundUrl } from '@/lib/play-sound';
import type { SoundboardSound } from '@/lib/database.types';

const STARTER_SOUNDS = [
  { name: 'Airhorn', sound_url: 'builtin:airhorn', keybind: 'Digit1', sort_order: 1 },
  { name: 'Cash', sound_url: 'builtin:cash', keybind: 'Digit2', sort_order: 2 },
  { name: 'Hype', sound_url: 'builtin:hype', keybind: 'Digit3', sort_order: 3 },
  { name: 'Applause', sound_url: 'builtin:applause', keybind: 'Digit4', sort_order: 4 },
  { name: 'Chime', sound_url: 'builtin:chime', keybind: 'Digit5', sort_order: 5 },
];

const KEY_OPTIONS = [
  ['Digit1', '1'],
  ['Digit2', '2'],
  ['Digit3', '3'],
  ['Digit4', '4'],
  ['Digit5', '5'],
  ['Digit6', '6'],
  ['Digit7', '7'],
  ['Digit8', '8'],
  ['Digit9', '9'],
  ['KeyQ', 'Q'],
  ['KeyW', 'W'],
  ['KeyE', 'E'],
  ['KeyR', 'R'],
  ['KeyT', 'T'],
  ['KeyY', 'Y'],
  ['KeyU', 'U'],
  ['KeyI', 'I'],
  ['KeyO', 'O'],
  ['KeyP', 'P'],
];

function keyLabel(code: string | null) {
  if (!code) return 'None';
  return KEY_OPTIONS.find(([value]) => value === code)?.[1] ?? code;
}

export function SoundboardManager({
  profileId,
  sounds,
}: {
  profileId: string;
  sounds: SoundboardSound[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function playOnStream(soundId: string) {
    setPlaying(soundId);
    try {
      const response = await fetch('/api/soundboard/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soundId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Could not play sound');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not play sound');
    } finally {
      window.setTimeout(() => setPlaying(null), 300);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      const sound = sounds.find((item) => item.enabled && item.keybind === event.code);
      if (!sound) return;

      event.preventDefault();
      void playOnStream(sound.id);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sounds]);

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
    else router.refresh();
  }

  async function uploadSound(file: File) {
    setBusy('upload');
    setError(null);

    try {
      const path = `${profileId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('soundboard').upload(path, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('soundboard').getPublicUrl(path);
      const { error: insertError } = await supabase.from('soundboard_sounds').insert({
        profile_id: profileId,
        name: name.trim() || file.name.replace(/\.[^/.]+$/, ''),
        sound_url: data.publicUrl,
        sort_order: sounds.length + 1,
      });
      if (insertError) throw insertError;

      setName('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
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
    else router.refresh();
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
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="card rounded-3xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Your sounds</h2>
              <p className="mt-1 text-sm text-white/40">
                Hotkeys work while the Klaups dashboard tab is focused.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={installStarterPack}
              disabled={busy === 'starter'}
            >
              {busy === 'starter' ? 'Adding…' : 'Add starter sounds'}
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {sounds.map((sound) => (
              <div
                key={sound.id}
                className={`rounded-2xl border p-4 transition ${
                  playing === sound.id
                    ? 'border-brand-400/60 bg-brand-500/10'
                    : 'border-white/[0.08] bg-white/[0.025]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{sound.name}</p>
                    <p className="mt-1 text-xs text-white/35">
                      {sound.sound_url.startsWith('builtin:') ? 'Klaups preset' : 'Custom upload'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs text-white/60 hover:bg-white/[0.1] hover:text-white"
                    onClick={() => playSoundUrl(sound.sound_url)}
                  >
                    Preview
                  </button>
                </div>

                <button
                  type="button"
                  className="mt-4 flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left text-sm font-semibold text-black transition hover:bg-white/90"
                  onClick={() => playOnStream(sound.id)}
                >
                  <span>Play on stream</span>
                  <span className="rounded-md bg-black/10 px-2 py-1 text-xs">
                    {keyLabel(sound.keybind)}
                  </span>
                </button>

                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <select
                    className="input text-sm"
                    value={sound.keybind ?? ''}
                    disabled={busy === sound.id}
                    onChange={(e) => updateSound(sound.id, { keybind: e.target.value || null })}
                  >
                    <option value="">No keybind</option>
                    {KEY_OPTIONS.map(([value, label]) => (
                      <option
                        key={value}
                        value={value}
                        disabled={sounds.some((item) => item.id !== sound.id && item.keybind === value)}
                      >
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-xl border border-red-400/15 px-3 text-xs text-red-300 hover:bg-red-500/10"
                    disabled={busy === sound.id}
                    onClick={() => removeSound(sound.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {sounds.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center">
                <p className="font-medium">Your soundboard is empty</p>
                <p className="mt-1 text-sm text-white/40">
                  Add the Klaups starter pack or upload your own MP3/WAV.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="card h-fit rounded-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-400">Custom sound</p>
          <h2 className="mt-2 text-xl font-semibold">Upload a sound</h2>
          <p className="mt-2 text-sm text-white/45">MP3, WAV, OGG or another browser-supported audio file.</p>

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
            accept="audio/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadSound(e.target.files[0])}
          />
        </div>
      </div>
    </div>
  );
}
