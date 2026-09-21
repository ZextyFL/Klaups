import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';


export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from('spotify_tokens').delete().eq('profile_id', user.id);
  }

  return NextResponse.redirect(`${siteUrl()}/dashboard/integrations`, { status: 303 });
}
