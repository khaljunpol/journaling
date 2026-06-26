import { decryptSecret, encryptSecret } from './connectionCrypto.ts';

export type StoredGoogleConnection = {
  userKey: string;
  email: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpires?: number;
  spreadsheetId: string;
  activeSubAccount: string;
  reconnectRequired: boolean;
  reconnectReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type SaveGoogleConnectionInput = {
  email: string;
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpires?: number;
  spreadsheetId: string;
  activeSubAccount: string;
  reconnectRequired?: boolean;
  reconnectReason?: string;
};

type StoredGoogleConnectionRecord = Omit<StoredGoogleConnection, 'refreshToken'> & {
  encryptedRefreshToken: string;
};

type RedisConfig = {
  url: string;
  token: string;
};

type RedisResponse<T> = {
  result?: T;
  error?: string;
};

const globalStoreKey = '__journalingGoogleConnections';
const globalWarningKey = '__journalingGoogleConnectionsWarned';

function getMemoryStore(): Map<string, string> {
  const g = globalThis as unknown as Record<string, Map<string, string> | boolean | undefined>;
  if (!g[globalStoreKey]) g[globalStoreKey] = new Map<string, string>();
  return g[globalStoreKey] as Map<string, string>;
}

function getRedisConfig(): RedisConfig | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function getConnectionKey(userKey: string): string {
  return `google-connection:${userKey.toLowerCase()}`;
}

async function redisCommand<T>(command: Array<string>): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) return null;

  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!res.ok) {
    throw new Error(`Connection store request failed with ${res.status}`);
  }

  const body = (await res.json()) as RedisResponse<T>;
  if (body.error) throw new Error(body.error);
  return body.result ?? null;
}

async function readRawConnection(userKey: string): Promise<string | null> {
  const key = getConnectionKey(userKey);
  if (getRedisConfig()) return redisCommand<string>(['GET', key]);
  return getMemoryStore().get(key) ?? null;
}

async function writeRawConnection(userKey: string, value: string): Promise<void> {
  const key = getConnectionKey(userKey);
  if (getRedisConfig()) {
    await redisCommand<string>(['SET', key, value]);
    return;
  }

  const g = globalThis as unknown as Record<string, boolean | undefined>;
  if (!g[globalWarningKey]) {
    g[globalWarningKey] = true;
    console.warn('Google connection store is using in-memory fallback; configure KV_REST_API_URL/KV_REST_API_TOKEN for durable storage.');
  }
  getMemoryStore().set(key, value);
}

async function deleteRawConnection(userKey: string): Promise<void> {
  const key = getConnectionKey(userKey);
  if (getRedisConfig()) {
    await redisCommand<number>(['DEL', key]);
    return;
  }
  getMemoryStore().delete(key);
}

export function encodeGoogleConnectionRecord(connection: StoredGoogleConnection): string {
  const { refreshToken, ...rest } = connection;
  const record: StoredGoogleConnectionRecord = {
    ...rest,
    encryptedRefreshToken: encryptSecret(refreshToken),
  };
  return JSON.stringify(record);
}

export function decodeGoogleConnectionRecord(raw: string): StoredGoogleConnection {
  const record = JSON.parse(raw) as StoredGoogleConnectionRecord;
  return {
    ...record,
    refreshToken: decryptSecret(record.encryptedRefreshToken),
  };
}

export async function getGoogleConnection(userKey: string): Promise<StoredGoogleConnection | null> {
  const raw = await readRawConnection(userKey);
  return raw ? decodeGoogleConnectionRecord(raw) : null;
}

export async function saveGoogleConnection(
  userKey: string,
  input: SaveGoogleConnectionInput,
): Promise<StoredGoogleConnection> {
  const existing = await getGoogleConnection(userKey);
  const now = new Date().toISOString();
  const refreshToken = input.refreshToken || existing?.refreshToken;
  if (!refreshToken) throw new Error('A refresh token is required to save a Google connection');

  const connection: StoredGoogleConnection = {
    userKey: userKey.toLowerCase(),
    email: input.email.trim().toLowerCase(),
    refreshToken,
    accessToken: input.accessToken ?? existing?.accessToken,
    accessTokenExpires: input.accessTokenExpires ?? existing?.accessTokenExpires,
    spreadsheetId: input.spreadsheetId,
    activeSubAccount: input.activeSubAccount,
    reconnectRequired: input.reconnectRequired ?? false,
    reconnectReason: input.reconnectReason,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await writeRawConnection(userKey, encodeGoogleConnectionRecord(connection));
  return connection;
}

export async function clearGoogleConnection(userKey: string): Promise<void> {
  await deleteRawConnection(userKey);
}

export async function markGoogleConnectionReconnectRequired(userKey: string, reason: string): Promise<void> {
  const existing = await getGoogleConnection(userKey);
  if (!existing) return;

  await writeRawConnection(userKey, encodeGoogleConnectionRecord({
    ...existing,
    reconnectRequired: true,
    reconnectReason: reason,
    updatedAt: new Date().toISOString(),
  }));
}
