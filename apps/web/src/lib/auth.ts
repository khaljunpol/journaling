import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import { isEmailAllowed, parseAllowlist } from '@/lib/allowlist';
import { DEMO_DOMAIN, isDemo, isDemoEmail } from '@/lib/demo';

const demo = isDemo();

export const allowedEmails = parseAllowlist(process.env.ALLOWED_EMAILS);
if (!demo && !allowedEmails.length) {
  console.warn('[auth] ALLOWED_EMAILS is empty: nobody can sign in');
}

// Demo: one sign-in with no input. Each visit gets a fresh visitor (and so a fresh sandbox).
const demoProvider = Credentials({
  id: 'demo',
  name: 'Demo',
  credentials: {},
  authorize: () => {
    const id = crypto.randomUUID();
    return { id, email: `demo-${id}@${DEMO_DOMAIN}`, name: 'Demo' };
  },
});

const googleProvider = Google({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  // Identity only — sheet access goes through a shared service account, so we
  // don't request sheet/drive scopes or offline access (no fragile refresh tokens).
  authorization: {
    params: {
      scope: ['openid', 'email', 'profile'].join(' '),
    },
  },
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: demo ? [demoProvider] : [googleProvider],
  // Credentials sign-in needs JWT sessions (also the default without an adapter).
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, profile }) {
      if (demo) return isDemoEmail(user?.email);
      return isEmailAllowed(profile?.email, allowedEmails);
    },
    // Login is identity only. The connected sheet is persisted in a
    // durable server cookie (see lib/server/sheetConnection.ts), not in the JWT — relying
    // on session.update() to persist it proved unreliable on next-auth v5 beta.
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
