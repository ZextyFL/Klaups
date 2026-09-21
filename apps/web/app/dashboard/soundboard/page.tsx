import { getCurrentCreator } from '@/lib/get-current-creator';
import { siteUrl } from '@/lib/site-url';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { CopyField } from '../copy-field';
import { SoundboardManager } from './soundboard-manager';

export default async function SoundboardPage() {
  const { settings, supabase, user } = await getCurrentCreator();

  const { data: sounds } = await supabase
    .from('soundboard_sounds')
    .select('*')
    .eq('profile_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const overlayUrl = `${siteUrl()}/overlay/soundboard?token=${settings.overlay_token}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Soundboard"
        description="Trigger sounds from Klaups with buttons or keyboard shortcuts and send them straight to your stream browser source."
      />

      <div className="card rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-semibold">Stream audio source</p>
            <p className="mt-1 text-sm text-white/45">
              Add this as a Browser Source and enable browser-source audio.
            </p>
          </div>
          <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
            Realtime
          </span>
        </div>
        <div className="mt-4">
          <CopyField label="Soundboard Browser Source" value={overlayUrl} />
        </div>
      </div>

      <SoundboardManager profileId={user.id} sounds={sounds ?? []} />
    </div>
  );
}
