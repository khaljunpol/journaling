import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    spreadsheetId: string | null;
    activeSubAccount: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    spreadsheetId?: string | null;
    activeSubAccount?: string | null;
  }
}
