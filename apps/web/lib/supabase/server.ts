import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Server Component / Route Handler client, scoped to the signed-in user via cookies.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (err) {
            // Expected when called from a Server Component render (cookies
            // are read-only there); middleware refreshes the session
            // instead. From a Server Action or Route Handler this should
            // never throw — log so a real failure isn't silently eaten.
            console.error('supabase cookie set() failed', name, err);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (err) {
            console.error('supabase cookie remove() failed', name, err);
          }
        },
      },
    }
  );
}
