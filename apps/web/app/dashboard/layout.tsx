import { signOut } from '@/app/auth/actions';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, settings } = await getCurrentCreator();

  const live = settings.tiktok_worker_enabled && settings.tiktok_status === 'live';
  const verified = settings.stripe_connect_onboarded && settings.stripe_payouts_enabled;

  return (
    <div className="relative min-h-screen bg-black lg:flex">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-brand-500/20 blur-[140px]" />
        <div className="absolute right-[-160px] top-1/3 h-[480px] w-[480px] rounded-full bg-fuchsia-500/10 blur-[140px]" />
        <div className="absolute bottom-[-200px] left-1/3 h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-[160px]" />
      </div>

      <Sidebar
        username={profile.username}
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
        live={live}
        viewerCount={settings.tiktok_viewer_count}
        verified={verified}
        signOutAction={signOut}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
