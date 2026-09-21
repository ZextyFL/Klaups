import { getCurrentCreator } from '@/lib/get-current-creator';
import { AlertTiers } from './alert-tiers';
import { CopyField } from '../copy-field';
import { siteUrl } from '@/lib/site-url';


export default async function AlertsPage() {
  const { settings, supabase, user } = await getCurrentCreator();

  const { data: tiers } = await supabase
    .from('alert_settings')
    .select('*')
    .eq('profile_id', user.id)
    .order('min_amount_cents', { ascending: true });

  const overlayUrl = `${siteUrl()}/overlay/alerts?token=${settings.overlay_token}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Donation alerts</h1>
        <p className="mt-1 text-white/60">
          Add a sound and image for donations. The highest tier under the donation amount wins.
        </p>
      </div>

      <div className="card">
        <CopyField label="OBS browser source URL" value={overlayUrl} />
        <p className="mt-2 text-xs text-white/40">Recommended size: 800×400, transparent background.</p>
      </div>

      <AlertTiers profileId={user.id} currency={settings.currency} tiers={tiers ?? []} />
    </div>
  );
}
