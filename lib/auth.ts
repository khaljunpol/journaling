import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const allowedEmails = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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
      if (!allowedEmails.length) return true;
      const email = profile?.email?.toLowerCase() || '';
      return allowedEmails.includes(email);
    },
    // Login is identity only. The connected sheet + active sub-account are persisted in a
    // durable server cookie (see lib/server/sheetConnection.ts), not in the JWT — relying
    // on session.update() to persist them proved unreliable on next-auth v5 beta.
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
