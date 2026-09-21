'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CreatorSettings } from '@/lib/database.types';

const CURRENCIES = ['eur', 'usd', 'gbp'];

export function DonationLinkForm({ settings }: { settings: CreatorSettings }) {
  const supabase = createClient();
  const router = useRouter();
  const [slug, setSlug] = useState(settings.donation_slug);
  const [currency, setCurrency] = useState(settings.currency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('creator_settings')
      .update({
        donation_slug: slug.toLowerCase(),
        currency,
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', settings.profile_id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Link slug</label>
        <div className="flex items-center gap-2">
          <span className="text-white/40">/donate/</span>
          <input
            className="input"
            value={slug}
            pattern="[a-z0-9\-]+"
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
        </div>
      </div>

      <div>
        <label className="label">Currency</label>
        <select
          className="input"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button className="btn-primary" onClick={save} disabled={saving} type="button">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
