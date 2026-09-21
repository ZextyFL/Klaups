import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Balance, CreatorSettings, Profile } from '@/lib/database.types';

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
}

// Creates the profile/settings/balance rows for a user that has none. This
// is normally done by the handle_new_user() DB trigger; the fallback covers
// projects where the migration ran after the first signups.
async function provisionCreator(userId: string, email: string | undefined, metaUsername: unknown) {
  const admin = createAdminClient();
  const base =
    slugify(typeof metaUsername === 'string' ? metaUsername : '') ||
    slugify(email?.split('@')[0] ?? '') ||
    `creator-${userId.slice(0, 8)}`;

  const { data: taken } = await admin.from('profiles').select('id').eq('username', base).maybeSingle();
  const username = taken && taken.id !== userId ? `${base}-${userId.slice(0, 4)}` : base;

  await admin.from('profiles').upsert({ id: userId, username, display_name: username }, { onConflict: 'id' });
  await admin
    .from('creator_settings')
    .upsert({ profile_id: userId, donation_slug: username }, { onConflict: 'profile_id', ignoreDuplicates: true });
  await admin.from('balances').upsert({ profile_id: userId }, { onConflict: 'profile_id', ignoreDuplicates: true });
}

// Loads the signed-in creator's profile + settings + balance. Redirects to
// /login if there's no session (middleware already guards /dashboard, this
// is the belt-and-suspenders check for direct server-component use).
export async function getCurrentCreator() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const load = () =>
    Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('creator_settings').select('*').eq('profile_id', user.id).maybeSingle(),
      supabase.from('balances').select('*').eq('profile_id', user.id).maybeSingle(),
    ]);

  let [{ data: profile }, { data: settings }, { data: balance }] = await load();

  if (!profile || !settings) {
    await provisionCreator(user.id, user.email, user.user_metadata?.username);
    [{ data: profile }, { data: settings }, { data: balance }] = await load();
  }

  if (!profile || !settings) {
    redirect('/login?error=Could+not+load+your+creator+profile.+Are+the+database+migrations+applied%3F');
  }

  return {
    supabase,
    user,
    profile: profile as Profile,
    settings: settings as CreatorSettings,
    balance: balance as Balance | null,
  };
}
