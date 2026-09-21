import Link from 'next/link';
import { signOut } from '@/app/auth/actions';
import { getCurrentCreator } from '@/lib/get-current-creator';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/profile', label: 'Profile' },
  { href: '/dashboard/donation-link', label: 'Donation link' },
  { href: '/dashboard/goals', label: 'Daily goal' },
  { href: '/dashboard/alerts', label: 'Alerts' },
  { href: '/dashboard/integrations', label: 'TikTok & Spotify' },
  { href: '/dashboard/payouts', label: 'Payouts' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentCreator();

  return (
    <div className="min-h-screen bg-black lg:flex">
      <aside className="border-b border-white/10 p-6 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <Link href="/" className="text-lg font-bold">
          Kl<span className="text-brand-500">aups</span>
        </Link>
        <p className="mt-1 truncate text-sm text-white/50">@{profile?.username}</p>

        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form action={signOut} className="mt-6">
          <button type="submit" className="btn-secondary w-full text-sm">
            Log out
          </button>
        </form>
      </aside>

      <main className="flex-1 p-6 lg:p-10">{children}</main>
    </div>
  );
}
