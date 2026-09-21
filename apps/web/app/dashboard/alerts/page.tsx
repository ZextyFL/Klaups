import { getCurrentCreator } from '@/lib/get-current-creator';
import { AlertTiers } from './alert-tiers';
import { CopyField } from '../copy-field';
import { siteUrl } from '@/lib/site-url';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TestSendButton } from '@/components/dashboard/TestSendButton';

export default async function AlertsPage() {
  const { settings, supabase, user } = await getCurrentCreator();

  const { data: tiers } = await supabase
    .from('alert_settings')
    .select('*')
    .eq('profile_id', user.id)
    .order('min_amount_cents', { ascending: true });

  const overlayUrl = `${siteUrl()}/overlay/alerts?token=${settings.overlay_token}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Build donation alerts, test them live and copy the exact Browser Source into OBS or TikTok LIVE Studio."
        action={
          <TestSendButton
            endpoint="/api/test/donation"
            body={{ amountCents: 500, donorName: 'Klaups Test', message: 'Your alert link is working!' }}
            label="Test alert"
            className="btn-accent"
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card overflow-hidden rounded-3xl p-0">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="font-semibold">Live alert preview</p>
              <p className="mt-0.5 text-xs text-white/35">
                The preview uses the same URL your stream uses.
              </p>
            </div>
            <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-300">
              Browser source
            </span>
          </div>
          <div className="relative aspect-[2/1] min-h-[280px] overflow-hidden bg-[#111114]">
            <div
              aria-hidden
              className="absolute inset-0 opacity-70 [background-image:linear-gradient(45deg,#1d1d22_25%,transparent_25%),linear-gradient(-45deg,#1d1d22_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1d1d22_75%),linear-gradient(-45deg,transparent_75%,#1d1d22_75%)] [background-position:0_0,0_12px,12px_-12px,-12px_0] [background-size:24px_24px]"
            />
            <span className="absolute left-4 top-4 rounded-full border border-white/[0.08] bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">
              Transparency preview
            </span>
            <iframe
              src={overlayUrl}
              title="Donation alert preview"
              className="relative h-full w-full border-0"
              allow="autoplay"
            />
          </div>
        </div>

        <div className="card h-fit rounded-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-400">
            Stream setup
          </p>
          <h2 className="mt-2 text-xl font-semibold">Your alert URL</h2>
          <p className="mt-2 text-sm leading-6 text-white/45">
            Add this as a Browser Source. Keep the URL private because it contains your overlay token.
          </p>
          <div className="mt-5">
            <CopyField label="Browser source URL" value={overlayUrl} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/45">
            <div className="rounded-xl bg-white/[0.04] p-3">
              <p className="text-white/70">Size</p>
              <p className="mt-1">800 × 400</p>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-3">
              <p className="text-white/70">Audio</p>
              <p className="mt-1">Enable source audio</p>
            </div>
          </div>
        </div>
      </div>

      <AlertTiers profileId={user.id} currency={settings.currency} tiers={tiers ?? []} />
    </div>
  );
}
