import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    spreadsheetId: string | null;
    activeSubAccount: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    spreadsheetId?: string | null;
    activeSubAccount?: string | null;
  }
}
