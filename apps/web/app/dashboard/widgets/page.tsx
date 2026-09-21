import Link from 'next/link';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { siteUrl } from '@/lib/site-url';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Icons, type IconName } from '@/components/dashboard/icons';
import { CopyField } from '../copy-field';

export default async function WidgetsPage() {
  const { settings } = await getCurrentCreator();
  const base = `${siteUrl()}/overlay`;
  const t = `token=${settings.overlay_token}`;

  const widgets: {
    name: string;
    icon: IconName;
    description: string;
    size: string;
    url: string;
    settingsHref?: string;
    settingsLabel?: string;
  }[] = [
    {
      name: 'Chat + TTS',
      icon: 'chat',
      description: 'Live chat and gifts on screen, read aloud with the voice you picked.',
      size: '600 × 500',
      url: `${base}/chat?${t}`,
      settingsHref: '/dashboard/integrations',
      settingsLabel: 'TTS settings',
    },
    {
      name: 'Chat + TTS (right side)',
      icon: 'chat',
      description: 'Same widget, docked to the right edge of your stream.',
      size: '600 × 500',
      url: `${base}/chat?${t}&side=right`,
    },
    {
      name: 'Donation alerts',
      icon: 'bell',
      description: 'Sound + image/GIF pop-up for every donation, tiered by amount.',
      size: '800 × 400',
      url: `${base}/alerts?${t}`,
      settingsHref: '/dashboard/alerts',
      settingsLabel: 'Alert tiers',
    },
    {
      name: 'Daily goal bar',
      icon: 'target',
      description: 'Progress bar that climbs live with every donation.',
      size: '480 × 80',
      url: `${base}/goal?${t}`,
      settingsHref: '/dashboard/goals',
      settingsLabel: 'Set goal',
    },
    {
      name: 'Viewer count',
      icon: 'eye',
      description: 'Live "watching now" badge straight from your TikTok room.',
      size: '260 × 60',
      url: `${base}/viewers?${t}`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Widgets"
        description="Add any of these to OBS as a Browser Source. Transparent background, no plugins."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {widgets.map((w) => {
          const Icon = Icons[w.icon];
          return (
            <div key={w.name} className="card flex flex-col rounded-3xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/50">
                  {w.size}
                </span>
              </div>
              <h2 className="mt-4 font-semibold">{w.name}</h2>
              <p className="mt-1 flex-1 text-sm text-white/50">{w.description}</p>
              <div className="mt-4">
                <CopyField label="Browser source URL" value={w.url} />
              </div>
              {w.settingsHref && (
                <Link href={w.settingsHref} className="btn-ghost mt-3 text-sm">
                  {w.settingsLabel} <Icons.arrow className="h-4 w-4" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="card mt-6 rounded-2xl text-sm text-white/50">
        <p className="font-medium text-white">Adding a widget to OBS</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Sources → + → Browser</li>
          <li>Paste the URL, set the width/height shown on the card</li>
          <li>Tick &quot;Control audio via OBS&quot; for the Chat + TTS and Alerts widgets so you hear them</li>
        </ol>
      </div>
    </div>
  );
}
