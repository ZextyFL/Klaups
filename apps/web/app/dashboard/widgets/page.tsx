import Link from 'next/link';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { siteUrl } from '@/lib/site-url';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Icons, type IconName } from '@/components/dashboard/icons';
import { TestSendButton } from '@/components/dashboard/TestSendButton';
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
    test?: 'chat' | 'donation';
  }[] = [
    {
      name: 'Klaups Stream Kit',
      icon: 'grid',
      description: 'Recommended: donation alerts, TikTok gift alerts, soundboard audio and your daily goal in one browser source.',
      size: '1920 × 1080',
      url: `${base}/stream-kit?${t}`,
      settingsHref: '/dashboard/alerts',
      settingsLabel: 'Customize alerts',
    },
    {
      name: 'Chat + TTS',
      icon: 'chat',
      description: 'Live chat and gifts on screen, read aloud with the voice you picked.',
      size: '600 × 500',
      url: `${base}/chat?${t}`,
      settingsHref: '/dashboard/integrations',
      settingsLabel: 'TTS settings',
      test: 'chat',
    },
    {
      name: 'Chat + TTS (right side)',
      icon: 'chat',
      description: 'Same widget, docked to the right edge of your stream.',
      size: '600 × 500',
      url: `${base}/chat?${t}&side=right`,
      test: 'chat',
    },
    {
      name: 'Donation alerts',
      icon: 'bell',
      description: 'Sound + image/GIF pop-up for every donation, tiered by amount.',
      size: '800 × 400',
      url: `${base}/alerts?${t}`,
      settingsHref: '/dashboard/alerts',
      settingsLabel: 'Alert tiers',
      test: 'donation',
    },
    {
      name: 'TikTok Gift Alerts',
      icon: 'gift',
      description: 'Transparent gift visuals plus the exact sound configured for each TikTok gift.',
      size: '800 × 400',
      url: `${base}/tiktok-gifts?${t}`,
      settingsHref: '/dashboard/tiktok-gifts',
      settingsLabel: 'Gift sounds',
    },
    {
      name: 'Soundboard audio',
      icon: 'music',
      description: 'Hidden realtime audio source used by your Klaups soundboard buttons and keybinds.',
      size: '1 × 1',
      url: `${base}/soundboard?${t}`,
      settingsHref: '/dashboard/soundboard',
      settingsLabel: 'Open soundboard',
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
        description="Start with the all-in-one Stream Kit, or use separate browser sources when you want precise scene control. Works in OBS, TikTok LIVE Studio and Streamlabs."
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
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {w.settingsHref && (
                  <Link href={w.settingsHref} className="btn-ghost text-sm">
                    {w.settingsLabel} <Icons.arrow className="h-4 w-4" />
                  </Link>
                )}
                {w.test === 'chat' && (
                  <TestSendButton
                    endpoint="/api/test/chat"
                    body={{ message: 'This is a test chat message!' }}
                    label="Send test message"
                  />
                )}
                {w.test === 'donation' && (
                  <TestSendButton
                    endpoint="/api/test/donation"
                    body={{ amountCents: 500, donorName: 'Test Donor' }}
                    label="Send test donation"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card mt-6 rounded-2xl text-sm text-white/50">
        <p className="font-medium text-white">Adding a widget</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <span className="text-white/70">OBS or TikTok LIVE Studio</span> (it&apos;s built on OBS,
            same steps): Sources → + → Browser
          </li>
          <li>
            <span className="text-white/70">Streamlabs / XSplit</span>: Add Source → Browser Source
          </li>
          <li>Paste the URL, set the width/height shown on the card</li>
          <li>Enable audio for Chat + TTS, Alerts and Soundboard browser sources</li>
        </ol>
      </div>
    </div>
  );
}
