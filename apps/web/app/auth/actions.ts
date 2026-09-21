'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
}

function configError() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return 'Supabase is not configured yet (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing).';
  }
  return null;
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const username = slugify(String(formData.get('username') ?? ''));

  if (!email || !password || !username) {
    redirect('/signup?error=Missing+fields');
  }

  const missing = configError();
  if (missing) redirect(`/signup?error=${encodeURIComponent(missing)}`);

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error || !data.user) {
    redirect(`/signup?error=${encodeURIComponent(error?.message ?? 'Could not sign up')}`);
  }

  // profiles / creator_settings / balances rows are created by the
  // handle_new_user() DB trigger (and self-healed in getCurrentCreator), so
  // this works whether or not email confirmation is required.

  if (!data.session) {
    redirect('/login?notice=Check+your+email+for+a+confirmation+link%2C+then+log+in');
  }

  redirect('/dashboard');
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const missing = configError();
  if (missing) redirect(`/login?error=${encodeURIComponent(missing)}`);

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
