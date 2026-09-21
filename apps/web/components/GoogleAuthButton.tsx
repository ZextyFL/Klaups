import { signInWithGoogle } from '@/app/auth/actions';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12 10.2v4.02h5.59c-.25 1.29-.98 2.38-2.07 3.12l3.35 2.6c1.96-1.81 3.09-4.48 3.09-7.64 0-.74-.07-1.45-.19-2.1H12Z"
      />
      <path
        fill="#4285F4"
        d="M12 22c2.8 0 5.15-.93 6.87-2.52l-3.35-2.6c-.93.63-2.12 1-3.52 1-2.7 0-4.99-1.82-5.81-4.27l-3.47 2.68A10.39 10.39 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.19 13.61A6.24 6.24 0 0 1 5.86 11.6c0-.7.12-1.38.33-2.01L2.72 6.9A10.38 10.38 0 0 0 1.64 11.6c0 1.68.4 3.27 1.08 4.7l3.47-2.69Z"
      />
      <path
        fill="#34A853"
        d="M12 5.32c1.52 0 2.88.52 3.95 1.54l2.96-2.96C17.14 2.25 14.8 1.2 12 1.2A10.39 10.39 0 0 0 2.72 6.9l3.47 2.69C7.01 7.14 9.3 5.32 12 5.32Z"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  source,
  label = 'Continue with Google',
}: {
  source: 'login' | 'signup';
  label?: string;
}) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="source" value={source} />
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.99]"
      >
        <GoogleIcon />
        {label}
      </button>
    </form>
  );
}
