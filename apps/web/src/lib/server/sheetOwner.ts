import { getSettings, setSetting } from '@/lib/googleSheets';
import { ownerCheck } from './sheetContextCore.ts';

const OWNER_KEY = 'ownerEmail';

/**
 * Read-only: true when another account already owns the sheet. Run this before writing anything to it.
 * A sheet with no Settings tab yet has no owner, so a failed read is not a refusal;
 * claimOrCheckOwner still checks again once the tabs exist.
 */
export async function ownedByAnother(spreadsheetId: string, email: string): Promise<boolean> {
  try {
    return ownerCheck((await getSettings({ spreadsheetId }))[OWNER_KEY], email) === 'deny';
  } catch {
    return false;
  }
}

/** True when `email` owns the sheet. A sheet with no owner yet is claimed for `email`. */
export async function claimOrCheckOwner(spreadsheetId: string, email: string): Promise<boolean> {
  const sa = { spreadsheetId };
  const verdict = ownerCheck((await getSettings(sa))[OWNER_KEY], email);
  if (verdict === 'claim') await setSetting(sa, OWNER_KEY, email.trim().toLowerCase());
  return verdict !== 'deny';
}
