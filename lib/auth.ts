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
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'https://www.googleapis.com/auth/drive.file',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
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
    async jwt({ token, account, trigger, session }) {
      // First sign-in: store Google OAuth tokens
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;
      }
      // Handle session.update() calls from client (e.g. after setup)
      if (trigger === 'update' && session) {
        if (session.spreadsheetId !== undefined) token.spreadsheetId = session.spreadsheetId;
        if (session.activeSubAccount !== undefined) token.activeSubAccount = session.activeSubAccount;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = (token.accessToken as string) || '';
      session.refreshToken = (token.refreshToken as string) || '';
      session.accessTokenExpires = (token.accessTokenExpires as number) || 0;
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
