import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';

// Target of Supabase's email confirmation / magic links: exchanges the
// one-time code for a session cookie, then lands the creator on the dashboard.
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code');

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteUrl()}/dashboard`);
    }
  }

  return NextResponse.redirect(`${siteUrl()}/login?error=Confirmation+link+is+invalid+or+expired`);
}
