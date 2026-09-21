import Link from 'next/link';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Icons, type IconName } from '@/components/dashboard/icons';

export default async function SettingsPage() {
  const { user } = await getCurrentCreator();

  const items: { title: string; description: string; href: string; icon: IconName }[] = [
    {
      title: 'Account & security',
      description: `Google login and account details for ${user.email ?? 'your account'}.`,
      href: '/dashboard/account',
      icon: 'shield',
    },
    {
      title: 'Creator profile',
      description: 'Profile photo, banner, display name and public bio.',
      href: '/dashboard/profile',
      icon: 'user',
    },
    {
      title: 'Donation page',
      description: 'Change your public donation link and default currency.',
      href: '/dashboard/donation-link',
      icon: 'heart',
    },
    {
      title: 'TikTok gift reactions',
      description: 'Per-gift sounds, volume, visuals, testing and the LIVE gift history.',
      href: '/dashboard/tiktok-gifts',
      icon: 'gift',
    },
    {
      title: 'Stream browser sources',
      description: 'Copy the all-in-one Stream Kit or individual OBS/TikTok LIVE Studio widgets.',
      href: '/dashboard/widgets',
      icon: 'grid',
    },
    {
      title: 'Connections & TTS',
      description: 'TikTok, Spotify, TTS voice and stream integrations.',
      href: '/dashboard/integrations',
      icon: 'link',
    },
    {
      title: 'Payouts & verification',
      description: 'Stripe verification, payout account and payout history.',
      href: '/dashboard/verify',
      icon: 'bank',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your Klaups account, creator page, integrations and payout setup."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => {
          const Icon = Icons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className="card group rounded-3xl transition hover:border-white/20 hover:bg-white/[0.065]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-white/70 group-hover:text-brand-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-white/45">{item.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
