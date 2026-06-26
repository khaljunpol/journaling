import { google } from 'googleapis';
import {
  getGoogleConnection,
  markGoogleConnectionReconnectRequired,
  saveGoogleConnection,
} from './googleConnectionStore.ts';

export type SheetAuthResolution = {
  ok: true;
  context: {
    sheetAuth: {
      accessToken: string;
      refreshToken: string;
      spreadsheetId: string;
    };
    account: string;
  };
} | {
  ok: false;
  status: 401 | 403;
  message: string;
};

export type RefreshedGoogleToken = {
  accessToken: string;
  accessTokenExpires?: number;
  refreshToken?: string;
};

export type GoogleTokenRefresher = (refreshToken: string) => Promise<RefreshedGoogleToken>;

const REFRESH_SKEW_MS = 60_000;

function isAccessTokenUsable(accessToken?: string, accessTokenExpires?: number): accessToken is string {
  return !!accessToken && !!accessTokenExpires && accessTokenExpires > Date.now() + REFRESH_SKEW_MS;
}

function getErrorCode(error: unknown): string {
  const e = error as {
    code?: string;
    message?: string;
    response?: { data?: { error?: string } };
  };
  return e.response?.data?.error || e.code || (e.message?.includes('invalid_grant') ? 'invalid_grant' : '');
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<RefreshedGoogleToken> {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('Google did not return an access token');

  return {
    accessToken: credentials.access_token,
    accessTokenExpires: credentials.expiry_date ?? undefined,
    refreshToken: credentials.refresh_token ?? undefined,
  };
}

export async function getSheetAuthForUser(
  userKey: string,
  refreshToken: GoogleTokenRefresher = refreshGoogleAccessToken,
): Promise<SheetAuthResolution> {
  const connection = await getGoogleConnection(userKey);
  if (!connection) return { ok: false, status: 403, message: 'Setup required' };
  if (connection.reconnectRequired) return { ok: false, status: 401, message: 'Reconnect Google' };

  if (isAccessTokenUsable(connection.accessToken, connection.accessTokenExpires)) {
    return {
      ok: true,
      context: {
        sheetAuth: {
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          spreadsheetId: connection.spreadsheetId,
        },
        account: connection.activeSubAccount || 'default',
      },
    };
  }

  try {
    const refreshed = await refreshToken(connection.refreshToken);
    const updated = await saveGoogleConnection(userKey, {
      email: connection.email,
      refreshToken: refreshed.refreshToken || connection.refreshToken,
      accessToken: refreshed.accessToken,
      accessTokenExpires: refreshed.accessTokenExpires,
      spreadsheetId: connection.spreadsheetId,
      activeSubAccount: connection.activeSubAccount,
      reconnectRequired: false,
    });

    return {
      ok: true,
      context: {
        sheetAuth: {
          accessToken: updated.accessToken || refreshed.accessToken,
          refreshToken: updated.refreshToken,
          spreadsheetId: updated.spreadsheetId,
        },
        account: updated.activeSubAccount || 'default',
      },
    };
  } catch (error: unknown) {
    const code = getErrorCode(error);
    if (code === 'invalid_grant') {
      await markGoogleConnectionReconnectRequired(userKey, 'invalid_grant');
      return { ok: false, status: 401, message: 'Reconnect Google' };
    }
    throw error;
  }
}
