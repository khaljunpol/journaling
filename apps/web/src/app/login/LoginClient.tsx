"use client";

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

// Demo: sign in a fresh visitor right away, no button.
function DemoSignIn() {
  const started = useRef(false);
  const failed = !!useSearchParams().get('error');
  useEffect(() => {
    // After a failed sign-in, do not retry (it would loop).
    if (failed) return;
    // Once only: a dev double-run would make two visitors.
    if (started.current) return;
    started.current = true;
    void signIn('demo', { callbackUrl: '/' });
  }, [failed]);
  return (
    <main className="mx-auto max-w-sm p-6">
      {failed ? (
        <p className="text-sm" role="alert">
          The demo couldn&apos;t open. Try again later.
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }} role="status">
          Opening the demo…
        </p>
      )}
    </main>
  );
}

function LoginContent() {
  const params = useSearchParams();
  const error = params.get('error');

  return (
    <main className="mx-auto max-w-sm space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Sign In</h1>
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Sign in with your Google account to access your journal.
      </p>

      {error === 'AccessDenied' && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Your account isn’t on the invite list. Contact the app owner to get access.
        </div>
      )}
      {error && error !== 'AccessDenied' && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Sign in failed. Please try again.
        </div>
      )}

      <button
        onClick={() => signIn('google', { callbackUrl: '/' })}
        className="w-full btn flex items-center justify-center gap-3"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
        Continue with Google
      </button>
    </main>
  );
}

export function LoginClient({ demo }: { demo: boolean }) {
  if (demo) {
    return (
      <Suspense>
        <DemoSignIn />
      </Suspense>
    );
  }
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
