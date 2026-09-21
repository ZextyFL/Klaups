import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { DonateForm } from './donate-form';

export default async function DonatePage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient();

  const { data: settings } = await supabase
    .from('creator_settings')
    .select('profile_id, currency, donation_slug')
    .eq('donation_slug', params.slug)
    .single();

  if (!settings) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, banner_url')
    .eq('id', settings.profile_id)
    .single();

  if (!profile) notFound();

  return (
    <main className="min-h-screen bg-black">
      <div
        className="h-48 w-full bg-cover bg-center bg-ink-800"
        style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined}
      />
      <div className="mx-auto -mt-12 max-w-md px-6 pb-20">
        <div
          className="h-24 w-24 rounded-full border-4 border-ink-900 bg-ink-800 bg-cover bg-center"
          style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
        />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Support {profile.display_name ?? profile.username}
        </h1>
        <p className="text-white/50">@{profile.username}</p>

        <div className="card mt-6">
          <DonateForm slug={settings.donation_slug} currency={settings.currency} />
        </div>
      </div>
    </main>
  );
}
