'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { AlertSetting } from '@/lib/database.types';

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

  async function addTier() {
    setBusy('new');
    const { error: insertError } = await supabase.from('alert_settings').insert({
      profile_id: profileId,
      min_amount_cents: 0,
      message_template: '{name} donated {amount}!',
      display_seconds: 6,
    });
    setBusy(null);
    if (insertError) setError(insertError.message);
    else router.refresh();
  }

  async function removeTier(id: string) {
    setBusy(id);
    await supabase.from('alert_settings').delete().eq('id', id);
    setBusy(null);
    router.refresh();
  }

  async function updateTier(id: string, patch: Partial<AlertSetting>) {
    setBusy(id);
    const { error: updateError } = await supabase.from('alert_settings').update(patch).eq('id', id);
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
      await updateTier(id, kind === 'sound' ? { sound_url: data.publicUrl } : { image_url: data.publicUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {tiers.map((tier) => (
        <AlertTierCard
          key={tier.id}
          tier={tier}
          currency={currency}
          busy={busy === tier.id}
          onChange={(patch) => updateTier(tier.id, patch)}
          onUploadSound={(f) => uploadMedia(tier.id, 'sound', f)}
          onUploadImage={(f) => uploadMedia(tier.id, 'image', f)}
          onRemove={() => removeTier(tier.id)}
        />
      ))}

      <button className="btn-secondary" onClick={addTier} disabled={busy === 'new'} type="button">
        {busy === 'new' ? 'Adding…' : '+ Add alert tier'}
      </button>
    </div>
  );
}

function AlertTierCard({
  tier,
  currency,
  busy,
  onChange,
  onUploadSound,
  onUploadImage,
  onRemove,
}: {
  tier: AlertSetting;
  currency: string;
  busy: boolean;
  onChange: (patch: Partial<AlertSetting>) => void;
  onUploadSound: (file: File) => void;
  onUploadImage: (file: File) => void;
  onRemove: () => void;
}) {
  const [minAmount, setMinAmount] = useState((tier.min_amount_cents / 100).toString());
  const [template, setTemplate] = useState(tier.message_template);
  const soundInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">
          Triggers at {currency.toUpperCase()} {minAmount || 0}+
        </p>
        <button className="text-sm text-red-400" onClick={onRemove} type="button">
          Remove
        </button>
      </div>

      <div>
        <label className="label">Minimum amount ({currency.toUpperCase()})</label>
        <input
          className="input"
          type="number"
          min={0}
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          onBlur={() => onChange({ min_amount_cents: Math.round(parseFloat(minAmount || '0') * 100) })}
        />
      </div>

      <div>
        <label className="label">On-screen message ({'{name}'} and {'{amount}'} are replaced)</label>
        <input
          className="input"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          onBlur={() => onChange({ message_template: template })}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <button className="btn-secondary text-sm" onClick={() => soundInput.current?.click()} disabled={busy} type="button">
            {tier.sound_url ? 'Change sound' : 'Upload sound'}
          </button>
          <input
            ref={soundInput}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUploadSound(e.target.files[0])}
          />
        </div>
        <div>
          <button className="btn-secondary text-sm" onClick={() => imageInput.current?.click()} disabled={busy} type="button">
            {tier.image_url ? 'Change image' : 'Upload image/gif'}
          </button>
          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUploadImage(e.target.files[0])}
          />
        </div>
      </div>
    </div>
  );
}
