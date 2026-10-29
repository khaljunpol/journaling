import { getSettings, setSetting } from '@/lib/googleSheets';
import { ownerCheck } from './sheetContextCore.ts';

const OWNER_KEY = 'ownerEmail';

/** True when `email` owns the sheet. A sheet with no owner yet is claimed for `email`. */
export async function claimOrCheckOwner(spreadsheetId: string, email: string): Promise<boolean> {
  const sa = { spreadsheetId };
  const verdict = ownerCheck((await getSettings(sa))[OWNER_KEY], email);
  if (verdict === 'claim') await setSetting(sa, OWNER_KEY, email.trim().toLowerCase());
  return verdict !== 'deny';
}
