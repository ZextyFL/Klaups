'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { AlertSetting } from '@/lib/database.types';
import { TestSendButton } from '@/components/dashboard/TestSendButton';
import { playSoundUrl } from '@/lib/play-sound';

const PRESETS: {
  name: string;
  description: string;
  preset: AlertSetting['preset'];
  soundUrl: string;
  template: string;
  duration: number;
}[] = [
  {
    name: 'Clean Pop',
    description: 'Minimal, sharp and readable.',
    preset: 'clean',
    soundUrl: 'builtin:chime',
    template: '{name} donated {amount}!',
    duration: 6,
  },
  {
    name: 'Hype',
    description: 'Big energy for larger donations.',
    preset: 'hype',
    soundUrl: 'builtin:hype',
    template: '🔥 {name} just dropped {amount}!',
    duration: 7,
  },
  {
    name: 'Neon',
    description: 'Glowing streamer-style alert.',
    preset: 'neon',
    soundUrl: 'builtin:cash',
    template: '⚡ {name} supported with {amount}',
    duration: 7,
  },
  {
    name: 'Minimal',
    description: 'Small and subtle for busy streams.',
    preset: 'minimal',
    soundUrl: 'builtin:chime',
    template: '{name} · {amount}',
    duration: 5,
  },
];

const BUILTIN_SOUNDS = [
  ['builtin:chime', 'Klaups Chime'],
  ['builtin:cash', 'Cash'],
  ['builtin:hype', 'Hype'],
  ['builtin:airhorn', 'Airhorn'],
  ['builtin:applause', 'Applause'],
];

export function AlertTiers({
  profileId,
  currency,
  tiers,
}: {
  profileId: string;
  currency: string;
  tiers: AlertSetting[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function addPreset(presetIndex = 0) {
    const preset = PRESETS[presetIndex];
    const nextMinimum =
      tiers.length === 0
        ? 0
        : Math.max(...tiers.map((tier) => tier.min_amount_cents)) + 500;

    setBusy('new');
    setError(null);
    const { error: insertError } = await supabase.from('alert_settings').insert({
      profile_id: profileId,
      min_amount_cents: nextMinimum,
      message_template: preset.template,
      display_seconds: preset.duration,
      sound_url: preset.soundUrl,
      preset: preset.preset,
    });
    setBusy(null);
    if (insertError) setError(insertError.message);
    else router.refresh();
  }

  async function removeTier(id: string) {
    setBusy(id);
    const { error: deleteError } = await supabase
      .from('alert_settings')
      .delete()
      .eq('id', id)
      .eq('profile_id', profileId);
    setBusy(null);
    if (deleteError) setError(deleteError.message);
    else router.refresh();
  }

  async function updateTier(id: string, patch: Partial<AlertSetting>) {
    setBusy(id);
    setError(null);
    const { error: updateError } = await supabase
      .from('alert_settings')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', profileId);
    setBusy(null);
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  async function uploadMedia(id: string, kind: 'sound' | 'image', file: File) {
    setBusy(id);
    setError(null);
    try {
      const bucket = 'alerts';
      const path = `${profileId}/${id}/${kind}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      await updateTier(
        id,
        kind === 'sound' ? { sound_url: data.publicUrl } : { image_url: data.publicUrl }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-400">
              Preset alerts
            </p>
            <h2 className="mt-1 text-xl font-semibold">Start with a saved Klaups alert</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((preset, index) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => addPreset(index)}
              disabled={busy === 'new'}
              className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-400/35 hover:bg-brand-500/[0.06]"
            >
              <div
                className={`mb-4 flex h-20 items-center justify-center rounded-xl border text-sm font-bold ${
                  preset.preset === 'hype'
                    ? 'border-orange-400/20 bg-orange-500/10 text-orange-300'
                    : preset.preset === 'neon'
                      ? 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300'
                      : preset.preset === 'minimal'
                        ? 'border-white/10 bg-black/40 text-white/65'
                        : 'border-brand-400/20 bg-brand-500/10 text-brand-300'
                }`}
              >
                {preset.name}
              </div>
              <p className="font-medium">{preset.name}</p>
              <p className="mt-1 text-xs leading-5 text-white/40">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="space-y-4">
        {tiers.map((tier, index) => (
          <AlertTierCard
            key={tier.id}
            tier={tier}
            index={index}
            currency={currency}
            busy={busy === tier.id}
            onChange={(patch) => updateTier(tier.id, patch)}
            onUploadSound={(file) => uploadMedia(tier.id, 'sound', file)}
            onUploadImage={(file) => uploadMedia(tier.id, 'image', file)}
            onRemove={() => removeTier(tier.id)}
          />
        ))}
      </div>

      {tiers.length === 0 && (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
          <p className="font-medium">No donation alerts yet</p>
          <p className="mt-1 text-sm text-white/40">
            Pick a preset above to create your first alert.
          </p>
        </div>
      )}
    </div>
  );
}

function AlertTierCard({
  tier,
  index,
  currency,
  busy,
  onChange,
  onUploadSound,
  onUploadImage,
  onRemove,
}: {
  tier: AlertSetting;
  index: number;
  currency: string;
  busy: boolean;
  onChange: (patch: Partial<AlertSetting>) => void;
  onUploadSound: (file: File) => void;
  onUploadImage: (file: File) => void;
  onRemove: () => void;
}) {
  const [minAmount, setMinAmount] = useState((tier.min_amount_cents / 100).toString());
  const [template, setTemplate] = useState(tier.message_template);
  const [duration, setDuration] = useState(tier.display_seconds.toString());
  const soundInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const preset = tier.preset ?? 'clean';

  function commitDuration() {
    const seconds = Math.min(60, Math.max(1, Math.round(parseFloat(duration || '6'))));
    setDuration(seconds.toString());
    onChange({ display_seconds: seconds });
  }

  function applyPreset(next: (typeof PRESETS)[number]) {
    setTemplate(next.template);
    setDuration(next.duration.toString());
    onChange({
      preset: next.preset,
      sound_url: next.soundUrl,
      message_template: next.template,
      display_seconds: next.duration,
    });
  }

  return (
    <div className="card rounded-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
            Alert tier {index + 1}
          </p>
          <h3 className="mt-1 text-lg font-semibold">
            {currency.toUpperCase()} {minAmount || 0}+
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <TestSendButton
            endpoint="/api/test/donation"
            body={{ amountCents: tier.min_amount_cents + 1, donorName: 'Klaups Test' }}
            label="Test alert"
            className="btn-accent text-sm"
          />
          <button
            className="rounded-xl px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
            onClick={onRemove}
            disabled={busy}
            type="button"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
        <div>
          <div
            className={`flex min-h-44 items-center justify-center overflow-hidden rounded-2xl border p-4 text-center ${
              preset === 'hype'
                ? 'border-orange-400/20 bg-gradient-to-br from-orange-500/15 to-red-500/5'
                : preset === 'neon'
                  ? 'border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500/15 to-indigo-500/10'
                  : preset === 'minimal'
                    ? 'border-white/10 bg-black/40'
                    : 'border-brand-400/20 bg-gradient-to-br from-brand-500/15 to-indigo-500/5'
            }`}
          >
            {tier.image_url ? (
              <img src={tier.image_url} alt="" className="max-h-36 max-w-full object-contain" />
            ) : (
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.08] text-xl">
                  ♥
                </div>
                <p className="mt-3 text-sm font-semibold">Donation alert</p>
                <p className="mt-1 text-xs text-white/40">{PRESETS.find((p) => p.preset === preset)?.name}</p>
              </div>
            )}
          </div>

          <button
            className="btn-secondary mt-3 w-full text-sm"
            onClick={() => imageInput.current?.click()}
            disabled={busy}
            type="button"
          >
            {tier.image_url ? 'Change image/GIF' : 'Add image/GIF'}
          </button>
          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUploadImage(e.target.files[0])}
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Alert style</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((item) => (
                <button
                  key={item.preset}
                  type="button"
                  disabled={busy}
                  onClick={() => applyPreset(item)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    preset === item.preset
                      ? 'border-brand-400/50 bg-brand-500/10 text-white'
                      : 'border-white/[0.08] bg-white/[0.025] text-white/55 hover:text-white'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Minimum donation ({currency.toUpperCase()})</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                onBlur={() =>
                  onChange({ min_amount_cents: Math.round(parseFloat(minAmount || '0') * 100) })
                }
              />
            </div>
            <div>
              <label className="label">Duration (seconds)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={60}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                onBlur={commitDuration}
              />
            </div>
          </div>

          <div>
            <label className="label">Message</label>
            <input
              className="input"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              onBlur={() => onChange({ message_template: template })}
            />
            <p className="mt-1 text-xs text-white/35">
              Use {'{name}'} and {'{amount}'} as placeholders.
            </p>
          </div>

          <div>
            <label className="label">Alert sound</label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <select
                className="input"
                value={tier.sound_url?.startsWith('builtin:') ? tier.sound_url : ''}
                onChange={(e) => e.target.value && onChange({ sound_url: e.target.value })}
              >
                <option value="">Custom upload / none</option>
                {BUILTIN_SOUNDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                className="btn-secondary text-sm"
                type="button"
                onClick={() => playSoundUrl(tier.sound_url)}
              >
                Preview
              </button>
              <button
                className="btn-secondary text-sm"
                onClick={() => soundInput.current?.click()}
                disabled={busy}
                type="button"
              >
                Upload
              </button>
            </div>
            <input
              ref={soundInput}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUploadSound(e.target.files[0])}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
