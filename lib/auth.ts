import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

import { isEmailAllowed, parseAllowlist } from '@/lib/allowlist';

export const allowedEmails = parseAllowlist(process.env.ALLOWED_EMAILS);
if (!allowedEmails.length) {
  console.warn('[auth] ALLOWED_EMAILS is empty: nobody can sign in');
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Identity only — sheet access goes through a shared service account, so we
      // don't request sheet/drive scopes or offline access (no fragile refresh tokens).
      authorization: {
        params: {
          scope: ['openid', 'email', 'profile'].join(' '),
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
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
