import { signOut } from '@/app/auth/actions';
import { getCurrentCreator } from '@/lib/get-current-creator';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, settings } = await getCurrentCreator();

  const live = settings.tiktok_worker_enabled && settings.tiktok_status === 'live';

  return (
    <div className="min-h-screen bg-black lg:flex">
      <Sidebar
        username={profile.username}
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
        live={live}
        viewerCount={settings.tiktok_viewer_count}
        signOutAction={signOut}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
