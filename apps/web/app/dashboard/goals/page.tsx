import { getCurrentCreator } from '@/lib/get-current-creator';
import { GoalForm } from './goal-form';
import { CopyField } from '../copy-field';

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export default async function GoalsPage() {
  const { settings, supabase, user } = await getCurrentCreator();

  const { data: todayGoal } = await supabase.rpc('get_or_create_today_goal', {
    p_profile_id: user.id,
  });

  const overlayUrl = `${siteUrl()}/overlay/goal?token=${settings.overlay_token}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Daily goal</h1>
        <p className="mt-1 text-white/60">
          A live-updating goal bar you can add to your stream as an OBS browser source.
        </p>
      </div>

      <div className="card">
        <CopyField label="OBS browser source URL" value={overlayUrl} />
        <p className="mt-2 text-xs text-white/40">Recommended size: 480×80, transparent background.</p>
      </div>

      <div className="card">
        <GoalForm settings={settings} todayGoal={todayGoal ?? null} />
      </div>
    </div>
  );
}
