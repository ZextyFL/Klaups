import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Balance, CreatorSettings, Profile } from '@/lib/database.types';

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

  const [{ data: profile }, { data: settings }, { data: balance }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('creator_settings').select('*').eq('profile_id', user.id).single(),
    supabase.from('balances').select('*').eq('profile_id', user.id).single(),
  ]);

  return {
    supabase,
    user,
    profile: profile as Profile,
    settings: settings as CreatorSettings,
    balance: balance as Balance | null,
  };
}
