'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const username = slugify(String(formData.get('username') ?? ''));

  if (!email || !password || !username) {
    redirect('/signup?error=Missing+fields');
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error || !data.user) {
    redirect(`/signup?error=${encodeURIComponent(error?.message ?? 'Could not sign up')}`);
  }

  // profiles / creator_settings / balances rows are created by the
  // handle_new_user() DB trigger, so this works whether or not email
  // confirmation is required.

  if (!data.session) {
    redirect('/login?notice=Check+your+email+to+confirm+your+account');
  }

  redirect('/dashboard');
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

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
