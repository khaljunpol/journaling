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
    async jwt({ token, trigger, session }) {
      // Per-user state lives in the JWT cookie (durable, no external store needed):
      // which spreadsheet they connected and which sub-account is active. Updated
      // from the client via session.update() after setup / account switch.
      if (trigger === 'update' && session) {
        if (session.spreadsheetId !== undefined) token.spreadsheetId = session.spreadsheetId;
        if (session.activeSubAccount !== undefined) token.activeSubAccount = session.activeSubAccount;
      }
      return token;
    },
    async session({ session, token }) {
      session.spreadsheetId = (token.spreadsheetId as string | null) ?? null;
      session.activeSubAccount = (token.activeSubAccount as string | null) ?? null;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
