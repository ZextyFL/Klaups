'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CreatorSettings, DailyGoal } from '@/lib/database.types';

export function GoalForm({
  settings,
  todayGoal,
}: {
  settings: CreatorSettings;
  todayGoal: DailyGoal | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [defaultGoal, setDefaultGoal] = useState((settings.default_daily_goal_cents / 100).toString());
  const [todayTarget, setTodayTarget] = useState(
    ((todayGoal?.target_amount_cents ?? settings.default_daily_goal_cents) / 100).toString()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);

    const defaultCents = Math.round(parseFloat(defaultGoal || '0') * 100);
    const todayCents = Math.round(parseFloat(todayTarget || '0') * 100);

    const { error: settingsError } = await supabase
      .from('creator_settings')
      .update({ default_daily_goal_cents: defaultCents, updated_at: new Date().toISOString() })
      .eq('profile_id', settings.profile_id);

    let goalError = null;
    if (todayGoal) {
      const { error: e } = await supabase
        .from('daily_goals')
        .update({ target_amount_cents: todayCents })
        .eq('id', todayGoal.id);
      goalError = e;
    } else {
      const { error: e } = await supabase.from('daily_goals').insert({
        profile_id: settings.profile_id,
        goal_date: new Date().toISOString().slice(0, 10),
        target_amount_cents: todayCents,
        currency: settings.currency,
      });
      goalError = e;
    }

    setSaving(false);
    if (settingsError || goalError) setError((settingsError ?? goalError)?.message ?? 'Error');
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Today&apos;s goal ({settings.currency.toUpperCase()})</label>
        <input
          className="input"
          type="number"
          min={0}
          step="1"
          value={todayTarget}
          onChange={(e) => setTodayTarget(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Default goal for future days</label>
        <input
          className="input"
          type="number"
          min={0}
          step="1"
          value={defaultGoal}
          onChange={(e) => setDefaultGoal(e.target.value)}
        />
        <p className="mt-1 text-xs text-white/40">
          Applied automatically the first time a new day&apos;s goal is needed.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button className="btn-primary" onClick={save} disabled={saving} type="button">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
